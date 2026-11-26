// lib/mixology/file-vault.ts
// 独家特调 · 从「文件库」导入长文档并自动转化为特调材料

import type { MixMaterial, MixMaterialKind, MixCharacterMaterial, MixPersonaMaterial, MixTextMaterial } from "./types";
import { findFileVaultApp, loadFileVaultLibrary, type FileVaultEntry } from "@/lib/chat-document-import";

/**
 * 允许从文件库长文档生成的材料种类
 * ticket / garnish / encore / filter / mechanism 是代码类或样式类，不开文本导入
 */
export const MIX_FILE_VAULT_KINDS: MixMaterialKind[] = [
    "character",
    "persona",
    "preface",
    "base",
    "flavor",
    "glass",
    "strength",
    "checklist",
];

function uid(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadMixologyFileVaultEntries(): Promise<FileVaultEntry[]> {
    const app = findFileVaultApp();
    if (!app) return [];
    return loadFileVaultLibrary();
}

/**
 * 把一篇文件库条目转成对应的特调材料。
 * 领域约定：
 * 1. 角色卡必须是 profileMode: "freeform"，否则保存时 profileText 会被覆盖清空；
 * 2. 面具使用 content 字段；
 * 3. 文本类材料（preface/base/flavor/glass/strength/checklist）使用 content 字段。
 */
export function convertFileVaultEntryToMaterial(
    entry: FileVaultEntry,
    kind: MixMaterialKind,
): MixMaterial {
    const now = Date.now();
    const id = uid(`mix_${kind}`);
    const name = entry.title || "未命名材料";
    const hook = entry.note || (entry.category ? `分类: ${entry.category}` : "从文件库导入");
    const tags = Array.isArray(entry.tags) && entry.tags.length > 0 ? [...entry.tags] : ["文件库"];

    if (kind === "character") {
        const mat: MixCharacterMaterial = {
            id,
            kind: "character",
            name,
            hook,
            author: "文件库",
            tags,
            createdAt: now,
            updatedAt: now,
            profileMode: "freeform",
            profileText: entry.text,
            worldText: "",
            greeting: "",
            avatar: "",
        };
        return mat;
    }

    if (kind === "persona") {
        const mat: MixPersonaMaterial = {
            id,
            kind: "persona",
            name,
            hook,
            author: "文件库",
            tags,
            createdAt: now,
            updatedAt: now,
            content: entry.text,
        };
        return mat;
    }

    const mat: MixTextMaterial = {
        id,
        kind,
        name,
        hook,
        author: "文件库",
        tags,
        createdAt: now,
        updatedAt: now,
        content: entry.text,
    };
    return mat;
}
