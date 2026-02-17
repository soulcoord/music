const test = require('node:test');
const assert = require('node:assert');
const { parseLyricsText } = require('../lyrics-parser.js');

test('parseLyricsText', async (t) => {
    await t.test('returns empty array for empty input', () => {
        assert.deepStrictEqual(parseLyricsText(''), []);
        assert.deepStrictEqual(parseLyricsText(null), []);
        assert.deepStrictEqual(parseLyricsText('   '), []);
    });

    await t.test('parses standard LRC format', () => {
        const input = '[00:01.00] Hello\n[00:02.50] World';
        const expected = [
            { time: 1.0, type: 'standard', text: 'Hello' },
            { time: 2.5, type: 'standard', text: 'World' }
        ];
        assert.deepStrictEqual(parseLyricsText(input), expected);
    });

    await t.test('parses standard LRC with 3-digit milliseconds', () => {
        const input = '[00:01.123] Hello';
        const expected = [
            { time: 1.123, type: 'standard', text: 'Hello' }
        ];
        assert.deepStrictEqual(parseLyricsText(input), expected);
    });

    await t.test('parses enhanced LRC format', () => {
        const input = '<00:01.00> Hello <00:01.50> World';
        const result = parseLyricsText(input);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].type, 'enhanced');
        assert.strictEqual(result[0].time, 1.0);
        assert.strictEqual(result[0].words.length, 2);
        assert.strictEqual(result[0].words[0].text, ' Hello ');
        assert.strictEqual(result[0].words[0].time, 1.0);
        assert.strictEqual(result[0].words[0].duration, 0.5);
        assert.strictEqual(result[0].words[1].text, ' World');
        assert.strictEqual(result[0].words[1].time, 1.5);
        assert.strictEqual(result[0].words[1].duration, 0.5);
    });

    await t.test('parses static lyrics', () => {
        const input = 'Line 1\nLine 2';
        const expected = [
            { time: 0, type: 'static', text: 'Line 1' },
            { time: 1, type: 'static', text: 'Line 2' }
        ];
        assert.deepStrictEqual(parseLyricsText(input), expected);
    });

    await t.test('sorts timestamps out of order', () => {
        const input = '[00:02.00] Second\n[00:01.00] First';
        const result = parseLyricsText(input);
        assert.strictEqual(result[0].time, 1.0);
        assert.strictEqual(result[1].time, 2.0);
    });

    await t.test('handles mixed lines and skips non-timestamped lines when timestamps are present', () => {
        const input = '\n[00:01.00] First\n\nNot a timestamp\n';
        const expected = [
            { time: 1.0, type: 'standard', text: 'First' }
        ];
        assert.deepStrictEqual(parseLyricsText(input), expected);
    });

    await t.test('handles 1-digit millisecond padding', () => {
        const input = '[00:01.5] Hello';
        const result = parseLyricsText(input);
        assert.strictEqual(result[0].time, 1.5);
    });

    await t.test('handles enhanced LRC with 1-digit milliseconds', () => {
        const input = '<00:01.5> Hello';
        const result = parseLyricsText(input);
        assert.strictEqual(result[0].time, 1.5);
        assert.strictEqual(result[0].words[0].time, 1.5);
    });
});
