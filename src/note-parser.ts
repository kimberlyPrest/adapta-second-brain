import { ParsedNote, NoteSection } from './types';
import { computeHash } from './hash-utils';

export async function parseNote(content: string, filePath: string): Promise<ParsedNote> {
  let fullContent = content;

  // Parse frontmatter
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/i;
  const frontmatterMatch = fullContent.match(frontmatterRegex);
  let frontmatter: Record<string, any> = {};

  if (frontmatterMatch) {
    const yamlStr = frontmatterMatch[1];
    yamlStr.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIndex).trim();
        let valueStr = trimmed.slice(colonIndex + 1).trim();

        // Handle arrays
        if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
          const arrayStr = valueStr.slice(1, -1);
          frontmatter[key] = arrayStr
            .split(',')
            .map((v) => v.trim())
            .map((v) => v.replace(/^["']|["']$/g, ''))
            .filter(Boolean);
        } else if (valueStr === 'true') {
          frontmatter[key] = true;
        } else if (valueStr === 'false') {
          frontmatter[key] = false;
        } else if (!isNaN(Number(valueStr)) && valueStr !== '') {
          frontmatter[key] = Number(valueStr);
        } else {
          frontmatter[key] = valueStr.replace(/^["']|["']$/g, '');
        }
      }
    });

    fullContent = fullContent.slice(frontmatterMatch[0].length);
  }

  // Extract title
  let title = (frontmatter.title as string) || '';
  if (!title) {
    const h1Match = fullContent.match(/^#\s+(.*)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    }
  }
  if (!title) {
    title = filePath.split('/').pop()?.replace(/\.md$/, '') || 'Untitled';
  }

  // Extract tags
  const tagsSet = new Set<string>();
  if (frontmatter.tags) {
    const fmTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
    fmTags.forEach((tag: any) => tagsSet.add(tag.toString()));
  }
  const inlineTagMatches = fullContent.matchAll(/#([\w\-]+)(?![\w\-])/g);
  for (const match of inlineTagMatches) {
    tagsSet.add(match[1]);
  }
  const tags = Array.from(tagsSet);

  // Extract outbound links
  const outboundLinks: string[] = [];
  const linkMatches = fullContent.matchAll(/\[\[((?:[^|\]]+?)(?:\|.*?)?)\]\]/g);
  for (const match of linkMatches) {
    outboundLinks.push(match[1].trim());
  }

  // Parse sections by ##+ headings
  const lines = fullContent.split('\n');
  const sections: NoteSection[] = [];
  let currentHeading: string | null = null;
  let currentContentLines: string[] = [];
  let sectionOrder = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const headingMatch = trimmedLine.match(/^#{2,} (.*)$/);

    if (headingMatch) {
      // Save previous section
      if (currentContentLines.length > 0) {
        const sectionContent = currentContentLines.join('\n').trim();
        if (sectionContent) {
          const contentHash = await computeHash(sectionContent);
          sections.push({
            sectionOrder: sectionOrder++,
            heading: currentHeading,
            content: sectionContent,
            contentHash,
          });
        }
      }

      currentHeading = headingMatch[1].trim();
      currentContentLines = [];
    } else {
      currentContentLines.push(line);
    }
  }

  // Last section
  if (currentContentLines.length > 0) {
    const sectionContent = currentContentLines.join('\n').trim();
    if (sectionContent) {
      const contentHash = await computeHash(sectionContent);
      sections.push({
        sectionOrder: sectionOrder++,
        heading: currentHeading,
        content: sectionContent,
        contentHash,
      });
    }
  }

  const fullHash = await computeHash(fullContent.trim());

  return {
    title,
    frontmatter,
    sections,
    outboundLinks,
    tags,
    fullContent: fullContent.trim(),
    fullHash,
  };
}

export async function computeSectionHashes(parsed: any): Promise<ParsedNote> {
  // This is kept for compatibility if needed by other files
  return parsed;
}

