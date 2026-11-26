"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, FileText, FolderOpen, Loader2, Paperclip, Search, Upload, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/modal";
import {
    attachmentCardLabel,
    buildImportedDocument,
    documentToAttachment,
    findFileVaultApp,
    INSERT_TEXT_WARN_CHARS,
    loadFileVaultLibrary,
    parseDocumentFile,
    resolveAttachmentText,
    type ChatDocAttachment,
    type FileVaultEntry,
    type ImportedDocument,
} from "@/lib/chat-document-import";

export type ChatDocImportProps = {
    open: boolean;
    onClose: () => void;
    onInsertText?: (text: string, doc: ImportedDocument) => void;
    onAttachDocument: (attachment: ChatDocAttachment) => void;
    initialTab?: "library" | "file";
};

export function ChatDocImport({
    open,
    onClose,
    onInsertText,
    onAttachDocument,
    initialTab = "library",
}: ChatDocImportProps) {
    const [tab, setTab] = useState<"library" | "file">(initialTab);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [vaultEntries, setVaultEntries] = useState<FileVaultEntry[]>([]);
    const [vaultLoaded, setVaultLoaded] = useState(false);
    const [hasVaultApp, setHasVaultApp] = useState(true);
    const [query, setQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("全部");

    const [previewDoc, setPreviewDoc] = useState<ImportedDocument | null>(null);
    const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
    const [parseProgress, setParseProgress] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!open) return;
        setTab(initialTab);
        setError("");
        setPreviewDoc(null);
        setSelectedChapters([]);
        setParseProgress(null);
    }, [open, initialTab]);

    useEffect(() => {
        if (!open || tab !== "library" || vaultLoaded) return;
        let cancelled = false;
        const app = findFileVaultApp();
        setHasVaultApp(Boolean(app));
        if (!app) {
            setVaultLoaded(true);
            return;
        }
        setLoading(true);
        loadFileVaultLibrary()
            .then((rows) => {
                if (cancelled) return;
                setVaultEntries(rows);
                setVaultLoaded(true);
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
    }, [open, tab, vaultLoaded]);

    const categories = useMemo(() => {
        const set = new Set<string>(["全部"]);
        for (const item of vaultEntries) {
            if (item.category) set.add(item.category);
        }
        return Array.from(set);
    }, [vaultEntries]);

    const filteredEntries = useMemo(() => {
        const q = query.trim().toLowerCase();
        return vaultEntries.filter((item) => {
            if (selectedCategory !== "全部" && item.category !== selectedCategory) return false;
            if (!q) return true;
            return (
                item.title.toLowerCase().includes(q)
                || item.note.toLowerCase().includes(q)
                || item.tags.some((t) => t.toLowerCase().includes(q))
            );
        });
    }, [vaultEntries, query, selectedCategory]);

    if (!open) return null;

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setError("");
        setLoading(true);
        setParseProgress(0);
        try {
            const doc = await parseDocumentFile(file, (ratio) => setParseProgress(Math.round(ratio * 100)));
            setPreviewDoc(doc);
            setSelectedChapters([]);
        } catch (err) {
            setError((err as Error)?.message || "文件解析失败");
        } finally {
            setLoading(false);
            setParseProgress(null);
        }
    };

    const handleSelectVaultEntry = (entry: FileVaultEntry) => {
        setError("");
        const doc = buildImportedDocument({
            title: entry.title,
            ext: entry.sourceType || "txt",
            text: entry.text,
            source: "library",
            category: entry.category,
            tags: entry.tags,
            note: entry.note,
        });
        setPreviewDoc(doc);
        setSelectedChapters([]);
    };

    const toggleChapter = (index: number) => {
        setSelectedChapters((prev) =>
            prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b),
        );
    };

    const buildCurrentAttachment = (): ChatDocAttachment | null => {
        if (!previewDoc) return null;
        const att = documentToAttachment(previewDoc);
        att.selected = selectedChapters;
        return att;
    };

    const handleAttach = () => {
        const att = buildCurrentAttachment();
        if (!att) return;
        onAttachDocument(att);
        onClose();
    };

    const handleInsert = () => {
        if (!previewDoc || !onInsertText) return;
        const att = buildCurrentAttachment();
        if (!att) return;
        const text = resolveAttachmentText(att);
        onInsertText(text, previewDoc);
        onClose();
    };

    const selectedTextLength = previewDoc
        ? (selectedChapters.length === 0
            ? previewDoc.charCount
            : selectedChapters.reduce((sum, idx) => sum + (previewDoc.chapters[idx]?.chars || 0), 0))
        : 0;

    return (
        <BottomSheet title={previewDoc ? `预览：${previewDoc.title}` : "导入文档 / 文件库"} onClose={onClose}>
            <div className="chat-doc-import">
                {!previewDoc ? (
                    <>
                        <div className="chat-doc-tabs">
                            <button
                                type="button"
                                className={`chat-doc-tab ${tab === "library" ? "is-active" : ""}`}
                                onClick={() => setTab("library")}
                            >
                                <BookOpen size={15} />
                                <span>文件库</span>
                            </button>
                            <button
                                type="button"
                                className={`chat-doc-tab ${tab === "file" ? "is-active" : ""}`}
                                onClick={() => setTab("file")}
                            >
                                <Upload size={15} />
                                <span>本地文件</span>
                            </button>
                        </div>

                        {error && <div className="chat-doc-error">{error}</div>}

                        {tab === "library" ? (
                            <div className="chat-doc-library">
                                {!hasVaultApp ? (
                                    <div className="chat-doc-empty">
                                        未检测到「文件库」应用（manifest.id: file.vault）。请先安装或使用「本地文件」导入。
                                    </div>
                                ) : loading ? (
                                    <div className="chat-doc-loading">
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>正在读取文件库…</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="chat-doc-search">
                                            <Search size={15} />
                                            <input
                                                type="text"
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="搜索标题、标签或备注…"
                                            />
                                        </div>
                                        {categories.length > 1 && (
                                            <div className="chat-doc-cats">
                                                {categories.map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        className={`chat-doc-cat ${selectedCategory === cat ? "is-active" : ""}`}
                                                        onClick={() => setSelectedCategory(cat)}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="chat-doc-list">
                                            {filteredEntries.length === 0 ? (
                                                <div className="chat-doc-empty">文件库暂无匹配材料</div>
                                            ) : (
                                                filteredEntries.map((entry) => (
                                                    <button
                                                        key={entry.id}
                                                        type="button"
                                                        className="chat-doc-item"
                                                        onClick={() => handleSelectVaultEntry(entry)}
                                                    >
                                                        <div className="chat-doc-item-head">
                                                            <FileText size={16} />
                                                            <span className="chat-doc-item-title">{entry.title}</span>
                                                            <span className="chat-doc-item-count">{entry.charCount.toLocaleString()} 字</span>
                                                        </div>
                                                        {(entry.category || entry.tags.length > 0) && (
                                                            <div className="chat-doc-item-meta">
                                                                {entry.category && <span className="chat-doc-badge">{entry.category}</span>}
                                                                {entry.tags.slice(0, 3).map((tag) => (
                                                                    <span key={tag} className="chat-doc-tag">#{tag}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {entry.note && <div className="chat-doc-item-note">{entry.note}</div>}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="chat-doc-upload">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".txt,.md,.docx,.doc,.pdf,.rtf,.html,.htm"
                                    onChange={handleFileChange}
                                    style={{ display: "none" }}
                                />
                                <button
                                    type="button"
                                    className="chat-doc-dropzone"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 size={24} className="animate-spin" />
                                            <span>正在解析文档{parseProgress !== null ? ` (${parseProgress}%)` : "…"}</span>
                                        </>
                                    ) : (
                                        <>
                                            <FolderOpen size={26} />
                                            <span className="chat-doc-dropzone-title">点击选择本地文档</span>
                                            <span className="chat-doc-dropzone-sub">支持 .docx / .doc / .txt / .md / .pdf / .rtf</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="chat-doc-preview">
                        <div className="chat-doc-preview-meta">
                            <div>
                                <strong>{previewDoc.charCount.toLocaleString()}</strong> 字 · 约{" "}
                                <strong>{previewDoc.tokenEstimate.toLocaleString()}</strong> tokens
                            </div>
                            {previewDoc.sourceNote && <div className="chat-doc-source-note">{previewDoc.sourceNote}</div>}
                        </div>

                        {previewDoc.chapters.length > 1 && (
                            <div className="chat-doc-chapters">
                                <div className="chat-doc-chapters-head">
                                    <span>选择章节（不选默认全选）</span>
                                    {selectedChapters.length > 0 && (
                                        <button type="button" onClick={() => setSelectedChapters([])}>
                                            清空选择
                                        </button>
                                    )}
                                </div>
                                <div className="chat-doc-chapters-list">
                                    {previewDoc.chapters.map((ch, idx) => {
                                        const active = selectedChapters.includes(idx);
                                        return (
                                            <button
                                                key={`${ch.title}-${idx}`}
                                                type="button"
                                                className={`chat-doc-chapter ${active ? "is-active" : ""}`}
                                                onClick={() => toggleChapter(idx)}
                                            >
                                                <span className="chat-doc-chapter-check">{active ? <Check size={12} /> : null}</span>
                                                <span className="chat-doc-chapter-title">{ch.title}</span>
                                                <span className="chat-doc-chapter-chars">{ch.chars.toLocaleString()} 字</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {onInsertText && selectedTextLength > INSERT_TEXT_WARN_CHARS && (
                            <div className="chat-doc-warn">
                                当前内容超过 {INSERT_TEXT_WARN_CHARS.toLocaleString()} 字，建议直接「作为文件卡发送」，避免输入框卡顿或刷屏。
                            </div>
                        )}

                        <div className="chat-doc-actions">
                            <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setPreviewDoc(null)}>
                                返回重选
                            </button>
                            {onInsertText && (
                                <button type="button" className="ui-btn ui-btn-outline" onClick={handleInsert}>
                                    插入输入框
                                </button>
                            )}
                            <button type="button" className="ui-btn ui-btn-primary" onClick={handleAttach}>
                                <Paperclip size={14} />
                                <span>作为文件卡发送</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </BottomSheet>
    );
}

export function ChatDocAttachmentBar({
    attachment,
    onRemove,
}: {
    attachment: ChatDocAttachment | null;
    onRemove: () => void;
}) {
    if (!attachment) return null;
    return (
        <div className="chat-doc-attachment-bar">
            <div className="chat-doc-attachment-info">
                <FileText size={14} />
                <span className="chat-doc-attachment-title">{attachmentCardLabel(attachment)}</span>
                <span className="chat-doc-attachment-meta">约 {attachment.tokenEstimate.toLocaleString()} tokens</span>
            </div>
            <button
                type="button"
                className="chat-doc-attachment-remove"
                onClick={onRemove}
                aria-label="移除文件附件"
            >
                <X size={14} />
            </button>
        </div>
    );
}
