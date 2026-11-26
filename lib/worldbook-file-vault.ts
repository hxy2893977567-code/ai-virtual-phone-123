// lib/worldbook-file-vault.ts
// 世界书 · 从「文件库」导入长文档，切分条目并自动提取触发关键词

import {
    buildImportedDocument,
    loadFileVaultLibrary,
    type FileVaultEntry,
} from "@/lib/chat-document-import";

export type WorldBookDraftEntry = {
    title: string;
    content: string;
    keys: string[];
};

const STOP_WORDS = new Set([
    "的", "了", "和", "是", "在", "我", "你", "他", "她", "它", "们",
    "这", "那", "有", "与", "或", "及", "对", "为", "被", "把", "从",
    "到", "以", "及", "一个", "没有", "可以", "因为", "所以", "如果",
    "但是", "然而", "虽然", "以及", "关于", "作为", "进行", "通过",
    "the", "and", "for", "that", "this", "with", "from", "are", "was",
]);

/**
 * 从段落标题与正文提取真实可用的触发关键词。
 * 若提取结果为空，退回使用文档名，避免产生无关键词的死条目。
 */
export function extractWorldBookKeywords(
    chapterTitle: string,
    content: string,
    docTitle: string,
): string[] {
    const candidates: string[] = [];

    const cleanChapterTitle = chapterTitle
        .replace(/^(第[零一二三四五六七八九十百千万\d]+[章节回卷篇部]|【|】|#+\s*)/g, "")
        .replace(/（\d+）$/g, "")
        .trim();

    if (cleanChapterTitle && cleanChapterTitle !== "全文" && cleanChapterTitle !== "开头" && !/^第\s*\d+\s*段$/.test(cleanChapterTitle)) {
        candidates.push(cleanChapterTitle);
    }

    // 抓取「」/『』/【】内的专有名词或概念词
    const bracketMatches = content.match(/[「『【]([^」』】]{2,14})[」』】]/g) || [];
    for (const raw of bracketMatches) {
        const inner = raw.slice(1, -1).trim();
        if (inner && !STOP_WORDS.has(inner.toLowerCase())) {
            candidates.push(inner);
        }
    }

    // 抓取高频出现的 2~6 字中文词组或英文专有名词
    const freq = new Map<string, number>();
    const tokens = content.match(/[\u4E00-\u9FA5]{2,6}|[A-Z][a-zA-Z0-9_-]{2,18}/g) || [];
    for (const tok of tokens) {
        if (STOP_WORDS.has(tok.toLowerCase())) continue;
        freq.set(tok, (freq.get(tok) || 0) + 1);
    }
    const sortedTokens = [...freq.entries()]
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([word]) => word);

    candidates.push(...sortedTokens);

    const unique = Array.from(new Set(candidates.map((s) => s.trim()).filter(Boolean))).slice(0, 6);
    if (unique.length === 0 && docTitle.trim()) {
        unique.push(docTitle.trim());
    }
    return unique;
}

export async function loadWorldBookFileVaultEntries(): Promise<FileVaultEntry[]> {
    return loadFileVaultLibrary();
}

export function splitFileVaultEntryToWorldBookDrafts(entry: FileVaultEntry): WorldBookDraftEntry[] {
    const doc = buildImportedDocument({
        title: entry.title,
        ext: entry.sourceType || "txt",
        text: entry.text,
        source: "library",
        category: entry.category,
        tags: entry.tags,
        note: entry.note,
    });

    return doc.chapters.map((ch) => ({
        title: ch.title === "全文" ? doc.title : `${doc.title} · ${ch.title}`,
        content: ch.text,
        keys: extractWorldBookKeywords(ch.title, ch.text, doc.title),
    }));
}
