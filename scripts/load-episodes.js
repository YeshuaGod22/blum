#!/usr/bin/env node
/**
 * load-episodes.js — Load episodes for agent boot context
 * 
 * Usage: node load-episodes.js <agent> [--recent=N] [--query="semantic query"]
 * 
 * Returns JSON array of episodes:
 * - Most recent N episodes (default 10)
 * - Plus top 5 semantically relevant if query provided (via qmd_search)
 * 
 * Designed to be called at session initiation to populate context.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const agent = args.find(a => !a.startsWith('--'));
const recentCount = parseInt((args.find(a => a.startsWith('--recent=')) || '--recent=10').split('=')[1]);
const query = (args.find(a => a.startsWith('--query=')) || '').replace('--query=', '');

if (!agent) {
    console.error('Usage: node load-episodes.js <agent> [--recent=N] [--query="..."]');
    process.exit(1);
}

const episodesDir = path.join(process.env.HOME, 'blum/shared/memory/episodes', agent);

// Load all episodes for this agent
function loadAllEpisodes() {
    if (!fs.existsSync(episodesDir)) {
        return [];
    }
    
    const files = fs.readdirSync(episodesDir)
        .filter(f => f.endsWith('.json') && !f.startsWith('.'))
        .sort()
        .reverse(); // Most recent first
    
    return files.map(f => {
        try {
            const content = fs.readFileSync(path.join(episodesDir, f), 'utf8');
            return JSON.parse(content);
        } catch (e) {
            console.error(`Failed to parse ${f}: ${e.message}`);
            return null;
        }
    }).filter(Boolean);
}

// Get most recent N episodes
function getRecentEpisodes(episodes, n) {
    return episodes.slice(0, n);
}

// Search for semantically relevant episodes using qmd_search
// Falls back to tag matching if qmd unavailable
function getRelevantEpisodes(episodes, queryStr, excludeIds, limit = 5) {
    if (!queryStr) return [];
    
    // Simple fallback: match against topic, summary, tags
    const queryLower = queryStr.toLowerCase();
    const scored = episodes
        .filter(e => !excludeIds.has(e.id))
        .map(ep => {
            let score = 0;
            if (ep.topic.toLowerCase().includes(queryLower)) score += 3;
            if (ep.summary.toLowerCase().includes(queryLower)) score += 2;
            if (ep.tags && ep.tags.some(t => t.toLowerCase().includes(queryLower))) score += 2;
            // Word overlap
            const words = queryLower.split(/\s+/);
            words.forEach(w => {
                if (ep.summary.toLowerCase().includes(w)) score += 0.5;
                if (ep.topic.toLowerCase().includes(w)) score += 0.5;
            });
            return { episode: ep, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    
    return scored.map(x => x.episode);
}

// Main
const allEpisodes = loadAllEpisodes();
const recent = getRecentEpisodes(allEpisodes, recentCount);
const recentIds = new Set(recent.map(e => e.id));
const relevant = getRelevantEpisodes(allEpisodes, query, recentIds);

const result = {
    agent,
    loadedAt: new Date().toISOString(),
    recentCount: recent.length,
    relevantCount: relevant.length,
    recent,
    relevant
};

console.log(JSON.stringify(result, null, 2));
