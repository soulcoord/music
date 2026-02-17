/**
 * Pure function to parse LRC text into an array of lyric objects.
 * Supports standard and enhanced LRC formats, and static text.
 */
function parseLyricsText(text) {
    if (!text || !text.trim()) return [];

    const lines = text.split('\n');
    let data = [];
    const regex = /^\[(\d{2}):(\d{2})\.(\d{1,3})\](.*)/;
    const enhancedRegex = /<(\d{2}):(\d{2})\.(\d{1,3})>([^<]*)/g;
    let hasTimestamps = false;

    lines.forEach(line => {
        line = line.trim();
        if (!line) return;

        if (line.includes('<') && line.includes('>')) {
            const words = [];
            let match;
            let firstTime = null;
            enhancedRegex.lastIndex = 0; // Reset regex state for each line
            while ((match = enhancedRegex.exec(line)) !== null) {
                const t = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3].padEnd(3, '0')) / 1000;
                if (firstTime === null) firstTime = t;
                words.push({ time: t, text: match[4] });
            }

            if (words.length) {
                hasTimestamps = true;
                for (let i = 0; i < words.length - 1; i++) {
                    words[i].duration = words[i + 1].time - words[i].time;
                }
                words[words.length - 1].duration = 0.5;
                data.push({ time: firstTime, type: 'enhanced', words });
            }
        } else {
            const match = line.match(regex);
            if (match) {
                hasTimestamps = true;
                const t = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3].padEnd(3, '0')) / 1000;
                const content = match[4].trim();
                if (content) {
                    data.push({ time: t, type: 'standard', text: content });
                }
            }
        }
    });

    if (!hasTimestamps && text.trim().length > 0) {
        data = lines.filter(l => l.trim()).map((l, i) => ({ time: i, type: 'static', text: l }));
    }

    if (hasTimestamps) {
        data.sort((a, b) => a.time - b.time);
    }
    return data;
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseLyricsText };
}
