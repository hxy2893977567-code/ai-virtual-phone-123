"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, FileText, Loader2, Plus, Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/modal";
import {
    convertFileVaultEntryToMaterial,
    loadMixologyFileVaultEntries,
    MIX_FILE_VAULT_KINDS,
} from "@/lib/mixology/file-vault";
import { MIX_KIND_LABELS, type MixMaterial, type MixMaterialKind } from "@/lib/mixology/types";
import type { FileVaultEntry } from "@/lib/chat-document-import";

export type MixFileVaultSheetProps = {
    open: boolean;
    onClose: () => void;
    targetKind?: MixMaterialKind;
    onImportMaterial: (material: MixMaterial, targetKind: MixMaterialKind) => void;
};

export function MixFileVaultSheet({
    open,
    onClose,
    targetKind: initialKind = "character",
    onImportMaterial,
}: MixFileVaultSheetProps) {
    const [entries, setEntries] = useState<FileVaultEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("全部");
    const [chosenKind, setChosenKind] = useState<MixMaterialKind>(
        MIX_FILE_VAULT_KINDS.includes(initialKind) ? initialKind : "character",
    );
    const [selectedEntry, setSelectedEntry] = useState<FileVaultEntry | null>(null);

    useEffect(() => {
        if (!open) return;
        setError("");
        setSelectedEntry(null);
        if (MIX_FILE_VAULT_KINDS.includes(initialKind)) {
            setChosenKind(initialKind);
        }
    }, [open, initialKind]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        loadMixologyFileVaultEntries()
            .then((rows) => {
                if (cancelled) return;
                setEntries(rows);
            })
            .catch((err) => {
                if (cancelled) return;
                setError((err as Error)?.message || "读取文件库失败");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

    const categories = useMemo(() => {
        const set = new Set<string>(["全部"]);
        for (const item of entries) {
            if (item.category) set.add(item.category);
        }
        return Array.from(set);
    }, [entries]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return entries.filter((item) => {
            if (selectedCategory !== "全部" && item.category !== selectedCategory) return false;
            if (!q) return true;
            return (
                item.title.toLowerCase().includes(q)
                || item.note.toLowerCase().includes(q)
                || item.tags.some((t) => t.toLowerCase().includes(q))
            );
        });
    }, [entries, query, selectedCategory]);

    if (!open) return null;

    const handleConfirmImport = () => {
        if (!selectedEntry) return;
        const mat = convertFileVaultEntryToMaterial(selectedEntry, chosenKind);
        onImportMaterial(mat, chosenKind);
        onClose();
    };

    return (
        <BottomSheet
            title={selectedEntry ? `导入为 ${MIX_KIND_LABELS[chosenKind] || "材料"}` : "从文件库导入材料"}
            onClose={onClose}
        >
            <div className="mix-file-vault">
                {error && <div className="mix-file-vault-error">{error}</div>}

                {!selectedEntry ? (
                    <>
                        <div className="mix-file-vault-search">
                            <Search size={15} />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="搜索标题、分类或标签…"
                            />
                        </div>

                        {categories.length > 1 && (
                            <div className="mix-file-vault-cats">
                                {categories.map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        className={`mix-file-vault-cat ${selectedCategory === cat ? "is-active" : ""}`}
                                        onClick={() => setSelectedCategory(cat)}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="mix-file-vault-list">
                            {loading ? (
                                <div className="mix-file-vault-loading">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>读取文件库中…</span>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="mix-file-vault-empty">文件库暂无匹配文档</div>
                            ) : (
                                filtered.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        className="mix-file-vault-item"
                                        onClick={() => setSelectedEntry(entry)}
                                    >
                                        <div className="mix-file-vault-item-head">
                                            <FileText size={16} />
                                            <span className="mix-file-vault-item-title">{entry.title}</span>
                                            <span className="mix-file-vault-item-count">{entry.charCount.toLocaleString()} 字</span>
                                        </div>
                                        {(entry.category || entry.tags.length > 0) && (
                                            <div className="mix-file-vault-item-meta">
                                                {entry.category && <span className="mix-file-vault-badge">{entry.category}</span>}
                                                {entry.tags.slice(0, 3).map((tag) => (
                                                    <span key={tag} className="mix-file-vault-tag">#{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                        {entry.note && <div className="mix-file-vault-item-note">{entry.note}</div>}
                                    </button>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <div className="mix-file-vault-confirm">
                        <div className="mix-file-vault-target-block">
                            <div className="mix-file-vault-target-label">选择要转化成的材料槽位：</div>
                            <div className="mix-file-vault-kind-chips">
                                {MIX_FILE_VAULT_KINDS.map((k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className={`mix-file-vault-kind-chip ${chosenKind === k ? "is-active" : ""}`}
                                        onClick={() => setChosenKind(k)}
                                    >
                                        {chosenKind === k && <Check size={12} />}
                                        <span>{MIX_KIND_LABELS[k]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mix-file-vault-preview">
                            <div className="mix-file-vault-preview-title">{selectedEntry.title}</div>
                            <div className="mix-file-vault-preview-stats">
                                <span>{selectedEntry.charCount.toLocaleString()} 字</span>
                                {selectedEntry.category && <span> · 分类: {selectedEntry.category}</span>}
                            </div>
                            <div className="mix-file-vault-preview-text">
                                {selectedEntry.text.slice(0, 600)}
                                {selectedEntry.text.length > 600 ? "…" : ""}
                            </div>
                        </div>

                        <div className="mix-file-vault-actions">
                            <button
                                type="button"
                                className="ui-btn ui-btn-ghost"
                                onClick={() => setSelectedEntry(null)}
                            >
                                重新选择
                            </button>
                            <button
                                type="button"
                                className="ui-btn ui-btn-primary"
                                onClick={handleConfirmImport}
                            >
                                <Plus size={15} />
                                <span>转化为{MIX_KIND_LABELS[chosenKind]}并装入</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}
