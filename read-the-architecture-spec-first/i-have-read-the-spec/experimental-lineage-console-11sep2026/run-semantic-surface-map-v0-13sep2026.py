#!/usr/bin/env python3
"""Blum semantic surface-map runner v0 — 13 Sep 2026.

Consumes a blum-semantic-input-manifest-v0 exported by Surface Atlas and emits
blum-semantic-coordinate-artifact-v0. Provider-free after model download.

Default stack:
  Qwen/Qwen3-Embedding-0.6B -> L2-normalized embeddings -> LocalMAP 2D
with PaCMAP available as an explicit fallback.
"""
from __future__ import annotations

import argparse
import inspect
import json
import math
import os
import platform
import sys
from pathlib import Path

import numpy as np

DEFAULT_MODEL = "Qwen/Qwen3-Embedding-0.6B"
SCHEMA_IN = "blum-semantic-input-manifest-v0"
SCHEMA_OUT = "blum-semantic-coordinate-artifact-v0"
RUNNER_VERSION = "blum-semantic-surface-map-runner-v0-13sep2026"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("manifest", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--projection", choices=["localmap", "pacmap"], default="localmap")
    p.add_argument("--seed", type=int, default=20260913)
    p.add_argument("--device", choices=["auto", "cpu", "mps", "cuda"], default="auto")
    p.add_argument("--batch-size", type=int, default=8)
    p.add_argument("--max-seq-length", type=int, default=4096)
    p.add_argument("--n-neighbors", type=int, default=10)
    p.add_argument("--coverage", choices=["complete", "partial"], default="complete")
    p.add_argument("--allow-device-fallback", action=argparse.BooleanOptionalAction, default=True)
    p.add_argument("--local-files-only", action="store_true", help="Refuse model downloads; use cached files only.")
    return p.parse_args()


def canonical(value):
    if isinstance(value, dict):
        return {k: canonical(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    return value


def stable_stringify(value) -> str:
    return json.dumps(canonical(value), ensure_ascii=False, separators=(",", ":"))


def fnv1a_js(text: str) -> str:
    # Match JS charCodeAt semantics: FNV-1a over UTF-16 code units.
    h = 0x811C9DC5
    raw = text.encode("utf-16-le", "surrogatepass")
    for i in range(0, len(raw), 2):
        code_unit = raw[i] | (raw[i + 1] << 8)
        h ^= code_unit
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def fingerprint(value) -> str:
    return "fnv1a:" + fnv1a_js(stable_stringify(value))


def choose_device(requested: str) -> str:
    import torch
    if requested != "auto":
        return requested
    if torch.cuda.is_available():
        return "cuda"
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_model(model_name: str, device: str, max_seq_length: int, local_files_only: bool):
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(model_name, device=device, local_files_only=local_files_only)
    model.max_seq_length = max_seq_length
    return model


def validate_embeddings(x: np.ndarray, expected_rows: int) -> None:
    if x.ndim != 2 or x.shape[0] != expected_rows or x.shape[1] < 2:
        raise RuntimeError(f"embedding_shape_invalid:{tuple(x.shape)}")
    if not np.isfinite(x).all():
        raise RuntimeError("embedding_non_finite")
    norms = np.linalg.norm(x, axis=1)
    if np.any(norms < 1e-8):
        raise RuntimeError("embedding_zero_vector")
    if float(np.std(x)) < 1e-8:
        raise RuntimeError("embedding_degenerate")
    if expected_rows > 1:
        sample = x[: min(expected_rows, 32)]
        if float(np.max(np.linalg.norm(sample - sample[0], axis=1))) < 1e-7:
            raise RuntimeError("embedding_rows_indistinguishable")


def embed(model, texts: list[str], batch_size: int) -> np.ndarray:
    out = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )
    out = np.asarray(out, dtype=np.float32)
    validate_embeddings(out, len(texts))
    return out


def construct_supported(cls, **kwargs):
    sig = inspect.signature(cls.__init__)
    accepted = {k: v for k, v in kwargs.items() if k in sig.parameters}
    return cls(**accepted), accepted


def project(x: np.ndarray, method: str, seed: int, n_neighbors: int):
    import pacmap
    np.random.seed(seed)
    common = dict(n_components=2, n_neighbors=n_neighbors, random_state=seed, apply_pca=True)
    if method == "localmap":
        reducer, used = construct_supported(pacmap.LocalMAP, **common)
    else:
        reducer, used = construct_supported(pacmap.PaCMAP, **common)
    try:
        y = reducer.fit_transform(x, init="pca")
        init = "pca"
    except TypeError:
        y = reducer.fit_transform(x)
        init = "library_default"
    y = np.asarray(y, dtype=np.float64)
    if y.shape != (x.shape[0], 2) or not np.isfinite(y).all():
        raise RuntimeError(f"projection_invalid:{tuple(y.shape)}")
    if x.shape[0] > 1 and float(np.std(y)) < 1e-10:
        raise RuntimeError("projection_degenerate")
    return y, used, init, getattr(pacmap, "__version__", None)


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    if manifest.get("schema") != SCHEMA_IN:
        raise SystemExit(f"wrong manifest schema: {manifest.get('schema')!r}")
    units = manifest.get("units") or []
    if not units:
        raise SystemExit("manifest has no units")
    span_ids = [str(u.get("spanId") or "") for u in units]
    if any(not s for s in span_ids) or len(set(span_ids)) != len(span_ids):
        raise SystemExit("manifest spanIds are missing or duplicated")
    texts = [str(u.get("text") or "") for u in units]

    requested_device = args.device
    device = choose_device(requested_device)
    fallback = None
    try:
        model = load_model(args.model, device, args.max_seq_length, args.local_files_only)
        vectors = embed(model, texts, args.batch_size)
    except Exception as exc:
        if device == "cpu" or not args.allow_device_fallback:
            raise
        print(f"WARNING: {device} embedding failed ({exc}); retrying on CPU.", file=sys.stderr)
        fallback = {"from": device, "to": "cpu", "reason": type(exc).__name__ + ": " + str(exc)}
        device = "cpu"
        model = load_model(args.model, device, args.max_seq_length, args.local_files_only)
        vectors = embed(model, texts, args.batch_size)

    coords, projection_kwargs, projection_init, pacmap_version = project(
        vectors, args.projection, args.seed, args.n_neighbors
    )

    spec = {
        "semanticCoordinateSpecId": f"surface-span-{args.model.split('/')[-1]}-{args.projection}-v0",
        "version": 0,
        "inputUnit": "surface_span",
        "coverage": args.coverage,
        "embedding": {
            "provider": "local_sentence_transformers",
            "model": args.model,
            "normalize": "l2",
            "taskInstruction": None,
            "textPolicy": "literal_span_text_no_prefix",
            "maxSeqLength": args.max_seq_length,
        },
        "projection": {
            "method": args.projection,
            "dimensions": 2,
            "seed": str(args.seed),
            "nNeighbors": args.n_neighbors,
            "init": projection_init,
            "parametersApplied": projection_kwargs,
        },
    }
    artifact = {
        "schema": SCHEMA_OUT,
        "spec": spec,
        "specFingerprint": fingerprint(spec),
        "spanSetFingerprint": manifest.get("spanSetFingerprint"),
        "coordinates": [
            {"spanId": span_id, "x": float(x), "y": float(y)}
            for span_id, (x, y) in zip(span_ids, coords)
        ],
        "runnerProvenance": {
            "runnerVersion": RUNNER_VERSION,
            "python": sys.version.split()[0],
            "platform": platform.platform(),
            "requestedDevice": requested_device,
            "actualDevice": device,
            "deviceFallback": fallback,
            "pacmapVersion": pacmap_version,
            "embeddingDimensions": int(vectors.shape[1]),
            "unitCount": len(span_ids),
            "cwd": os.getcwd(),
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE {args.output}")
    print(f"units={len(span_ids)} dims={vectors.shape[1]} device={device} projection={args.projection}")
    print(f"spanSetFingerprint={artifact['spanSetFingerprint']}")
    print(f"specFingerprint={artifact['specFingerprint']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
