'use strict';

// BLUM BATTERY LIBRARY CORE v0 — 11 Sep 2026
// Pure data/validation helpers. No provider calls and no UI state.

const crypto = typeof require === 'function' ? require('crypto') : null;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
}

function sha256(text) {
  if (!crypto) throw new Error('sha256_requires_node_in_v0');
  return 'sha256:' + crypto.createHash('sha256').update(String(text)).digest('hex');
}

function normalizeItem(item) {
  return {
    id: String(item.id || '').trim(),
    family: String(item.family || '').trim(),
    construct: String(item.construct || '').trim(),
    text: String(item.text || ''),
    responseType: String(item.responseType || 'free'),
    scorer: String(item.scorer || '').trim(),
    parser: String(item.parser || '').trim(),
    tags: Array.isArray(item.tags) ? [...new Set(item.tags.map(x => String(x).trim()).filter(Boolean))].sort() : [],
    metadata: item.metadata && typeof item.metadata === 'object' ? JSON.parse(JSON.stringify(item.metadata)) : {},
  };
}

function normalizeGroup(group) {
  return {
    id: String(group.id || '').trim(),
    label: String(group.label || '').trim(),
    itemIds: [...new Set((group.itemIds || []).map(x => String(x).trim()).filter(Boolean))],
  };
}

function normalizeBattery(input) {
  const items = (input.items || []).map(normalizeItem);
  const groups = (input.groups || []).map(normalizeGroup);
  return {
    schema: 'blum-battery-v0',
    batteryId: String(input.batteryId || '').trim(),
    name: String(input.name || '').trim(),
    version: Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
    status: input.status === 'frozen' ? 'frozen' : 'draft',
    description: String(input.description || ''),
    items,
    groups,
    createdAt: input.createdAt || null,
    frozenAt: input.frozenAt || null,
    fingerprint: input.fingerprint || null,
  };
}

function validateBattery(input) {
  const battery = normalizeBattery(input);
  const errors = [];
  const warnings = [];
  if (!battery.batteryId) errors.push('battery_id_required');
  if (!battery.name) errors.push('battery_name_required');
  if (!battery.items.length) warnings.push('battery_has_no_items');

  const seen = new Set();
  for (const item of battery.items) {
    if (!item.id) errors.push('item_id_required');
    else if (seen.has(item.id)) errors.push(`duplicate_item_id:${item.id}`);
    else seen.add(item.id);
    if (!item.text.trim()) warnings.push(`item_text_empty:${item.id || '<missing>'}`);
  }

  const groupSeen = new Set();
  for (const group of battery.groups) {
    if (!group.id) errors.push('group_id_required');
    else if (groupSeen.has(group.id)) errors.push(`duplicate_group_id:${group.id}`);
    else groupSeen.add(group.id);
    for (const id of group.itemIds) if (!seen.has(id)) errors.push(`group_unknown_item:${group.id}:${id}`);
  }
  return { battery, errors, warnings, valid: errors.length === 0 };
}

function freezeBattery(input, now = new Date().toISOString()) {
  const { battery, errors, warnings } = validateBattery(input);
  if (errors.length) throw new Error('battery_invalid:' + errors.join(','));
  if (battery.status === 'frozen' && battery.fingerprint) return { battery, warnings };
  const canonical = { ...battery, status: 'frozen', frozenAt: now, fingerprint: null };
  canonical.fingerprint = sha256(stableStringify(canonical));
  return { battery: canonical, warnings };
}

function newDraftVersion(frozenBattery) {
  const b = normalizeBattery(frozenBattery);
  if (b.status !== 'frozen' || !b.fingerprint) throw new Error('source_battery_must_be_frozen');
  return {
    ...b,
    version: b.version + 1,
    status: 'draft',
    frozenAt: null,
    fingerprint: null,
    createdAt: new Date().toISOString(),
    provenance: { createdFromFingerprint: b.fingerprint },
  };
}

function resolveSelection(batteryInput, selection = {}) {
  const { battery, errors } = validateBattery(batteryInput);
  if (errors.length) throw new Error('battery_invalid:' + errors.join(','));
  const known = new Set(battery.items.map(x => x.id));
  let ids = [];
  if (selection.groupIds?.length) {
    const groupMap = new Map(battery.groups.map(g => [g.id, g]));
    for (const gid of selection.groupIds) {
      const g = groupMap.get(gid);
      if (!g) throw new Error(`unknown_group:${gid}`);
      ids.push(...g.itemIds);
    }
  }
  if (selection.itemIds?.length) ids.push(...selection.itemIds);
  if (!selection.groupIds?.length && !selection.itemIds?.length) ids = battery.items.map(x => x.id);
  ids = [...new Set(ids)];
  for (const id of ids) if (!known.has(id)) throw new Error(`unknown_item:${id}`);
  return ids;
}

function makeAttachment({ battery, branchIds, groupIds = [], itemIds = [], order = 'canonical' }) {
  const b = normalizeBattery(battery);
  if (b.status !== 'frozen' || !b.fingerprint) throw new Error('battery_attachment_requires_frozen_version');
  const selectedItemIds = resolveSelection(b, { groupIds, itemIds });
  return {
    schema: 'blum-battery-attachment-v0',
    batteryRef: {
      batteryId: b.batteryId,
      version: b.version,
      fingerprint: b.fingerprint,
    },
    branchIds: [...new Set((branchIds || []).map(String))],
    selectedGroupIds: [...new Set(groupIds.map(String))],
    selectedItemIds,
    order,
  };
}

module.exports = {
  stableStringify,
  normalizeItem,
  normalizeGroup,
  normalizeBattery,
  validateBattery,
  freezeBattery,
  newDraftVersion,
  resolveSelection,
  makeAttachment,
};
