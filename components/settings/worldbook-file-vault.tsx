"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, FileText, Loader2, Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/modal";
import {
    loadWorldBookFileVaultEntries,
    splitFileVaultEntryToWorldBookDrafts,
    type WorldBookDraftEntry,
} from "@/lib/worldbook-file-vault";
import type { FileVaultEntry } from "@/lib/chat-document-import";

export type WorldBookFileVaultSheetProps = {
    open: boolean;
    onClose: () => void;
    onImportEntries: (entries: WorldBookDraftEntry[]) => void;
};

export function WorldBookFileVaultSheet({
    open,
    onClose,
    onImportEntries,
}: WorldBookFileVaultSheetProps) {
    const [entries, setEntries] = useState<FileVaultEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [selectedEntry, setSelectedEntry] = useState<FileVaultEntry | null>(null);
    const [drafts, setDrafts] = useState<WorldBookDraftEntry[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    useEffect(() => {
        if (!open) return;
        setError("");
        setSelectedEntry(null);
        setDrafts([]);
        setSelectedIndices([]);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        loadWorldBookFileVaultEntries()
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

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter((item) => (
            item.title.toLowerCase().includes(q)
            || item.note.toLowerCase().includes(q)
            || item.tags.some((t) => t.toLowerCase().includes(q))
        ));
    }, [entries, query]);

    if (!open) return null;

    const handlePickEntry = (entry: FileVaultEntry) => {
        const nextDrafts = splitFileVaultEntryToWorldBookDrafts(entry);
        setSelectedEntry(entry);
        setDrafts(nextDrafts);
        setSelectedIndices(nextDrafts.map((_, i) => i));
    };

    const toggleIndex = (idx: number) => {
        setSelectedIndices((prev) =>
            prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].sort((a, b) => a - b),
        );
    };

    const handleConfirm = () => {
        const picked = selectedIndices.map((i) => drafts[i]).filter(Boolean);
        if (picked.length === 0) return;
        onImportEntries(picked);
        onClose();
    };

    return (
        <BottomSheet
            title={selectedEntry ? `切分预览：${selectedEntry.title}` : "从文件库导入世界书条目"}
            onClose={onClose}
        >
            <div className="wb-file-vault">
                {error && <div className="wb-file-vault-error">{error}</div>}

                {!selectedEntry ? (
                    <>
                        <div className="wb-file-vault-search">
                            <Search size={15} />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="搜索世界观文档、标签或备注…"
                            />
                        </div>

                        <div className="wb-file-vault-list">
                            {loading ? (
                                <div className="wb-file-vault-loading">
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>正在读取文件库…</span>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="wb-file-vault-empty">文件库暂无可用文档</div>
                            ) : (
                                filtered.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        className="wb-file-vault-item"
                                        onClick={() => handlePickEntry(entry)}
                                    >
                                        <div className="wb-file-vault-item-head">
                                            <FileText size={16} />
                                            <span className="wb-file-vault-item-title">{entry.title}</span>
                                            <span className="wb-file-vault-item-count">{entry.charCount.toLocaleString()} 字</span>
                                        </div>
                                        {entry.note && <div className="wb-file-vault-item-note">{entry.note}</div>}
                                    </button>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <div className="wb-file-vault-preview">
                        <div className="wb-file-vault-preview-head">
                            <span>已切分为 {drafts.length} 条（已选 {selectedIndices.length} 条）</span>
                            <button
                                type="button"
                                onClick={() => setSelectedIndices(
                                    selectedIndices.length === drafts.length ? [] : drafts.map((_, i) => i),
                                )}
                            >
                                {selectedIndices.length === drafts.length ? "全不选" : "全选"}
                            </button>
                        </div>

                        <div className="wb-file-vault-drafts">
                            {drafts.map((draft, idx) => {
                                const active = selectedIndices.includes(idx);
                                return (
                                    <button
                                        key={`${draft.title}-${idx}`}
                                        type="button"
                                        className={`wb-file-vault-draft ${active ? "is-active" : ""}`}
                                        onClick={() => toggleIndex(idx)}
                                    >
                                        <div className="wb-file-vault-draft-top">
                                            <span className="wb-file-vault-draft-check">
                                                {active ? <Check size={12} /> : null}
                                            </span>
                                            <span className="wb-file-vault-draft-title">{draft.title}</span>
                                        </div>
                                        <div className="wb-file-vault-draft-keys">
                                            关键词：{draft.keys.join(" / ")}
                                        </div>
                                        <div className="wb-file-vault-draft-snippet">
                                            {draft.content.slice(0, 120)}
                                            {draft.content.length > 120 ? "…" : ""}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="wb-file-vault-actions">
                            <button
                                type="button"
                                className="ui-btn ui-btn-ghost"
                                onClick={() => setSelectedEntry(null)}
                            >
                                返回重选
                            </button>
                            <button
                                type="button"
                                className="ui-btn ui-btn-primary"
                                disabled={selectedIndices.length === 0}
                                onClick={handleConfirm}
                            >
                                <BookOpen size={15} />
                                <span>导入 {selectedIndices.length} 条到当前世界书</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}
