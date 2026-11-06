/*
 * Foreground-only colour adapter for Custom Highlight grouping.
 * The HSL foreground mapping is adapted from Dark Reader's modifyFgHSL:
 * https://github.com/darkreader/darkreader/blob/main/src/inject/dynamic-theme/modify-colors.ts
 * Reviewed 2026-11-06. This is a small adaptation, not Dark Reader's theme engine.
 *
 * MIT License
 * Copyright (c) 2026 Dark Reader Ltd.
 * All rights reserved.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Local changes:
 * - Neutral foreground pole is #d8d8d8.
 * - Saturated dark red/green/blue keep their hue; dark lightness alone is not
 *   classified as neutral. Dark Reader's blue-hue compression is not used.
 * - Already readable chromatic colours are retained. Bright colours are not
 *   inverted; white/near-white neutral text is capped at the foreground pole.
 * - An effective opaque background is REQUIRED. Readable original colours on
 *   light/white signature blocks are retained instead of applying pale ink.
 * - Contrast checks use the alpha-composited display colour. Alpha is never
 *   increased, so transparent text stays transparent; low alpha may make the
 *   requested contrast physically impossible, reported by meetsContrast=false.
 *
 * Pure API: transform(foreground, effectiveOpaqueBackground[, minimumContrast])
 * returns {css, rgba, contrast, meetsContrast, changed, reason}, or null for
 * unsupported input. parse(), composite(), contrast() are also pure.
 * No DOM, CSSOM, clipboard, timers, network, app or content access. The caller
 * groups Text-node Ranges by returned css plus backdrop and uses ::highlight.
 * Do not assume gradients/images are a solid backdrop; return to original
 * rendering when the caller cannot resolve a dependable background.
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FoxEditorForegroundColors = api;
}(typeof globalThis === 'object' ? globalThis : this, function () {
    'use strict';
    var POLE = 216 / 255;
    var MIN_LIGHTNESS = 0.55;
    function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
    function number(value) { return typeof value === 'number' && isFinite(value); }
    function copy(c) { return {r: c.r, g: c.g, b: c.b, a: c.a}; }
    function valid(c) {
        return c && number(c.r) && number(c.g) && number(c.b) &&
            number(c.a) && c.r >= 0 && c.r <= 255 && c.g >= 0 &&
            c.g <= 255 && c.b >= 0 && c.b <= 255 && c.a >= 0 && c.a <= 1;
    }
    function parse(value) {
        if (value && typeof value === 'object') {
            var object = {r: value.r, g: value.g, b: value.b,
                a: value.a === undefined ? 1 : value.a};
            return valid(object) ? object : null;
        }
        if (typeof value !== 'string') return null;
        var text = value.trim().toLowerCase(), match, parts;
        if (text === 'transparent') return {r: 0, g: 0, b: 0, a: 0};
        if ((match = /^#([a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})$/.exec(text))) {
            var hex = match[1];
            if (hex.length <= 4) hex = hex.split('').map(function (x) { return x + x; }).join('');
            return {r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16), a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1};
        }
        if (!(match = /^rgba?\(([^()]*)\)$/.exec(text))) return null;
        parts = match[1].trim().split(/[\s,/]+/);
        if (parts.length !== 3 && parts.length !== 4) return null;
        var values = [];
        for (var i = 0; i < parts.length; i++) {
            if (!/^(?:\d+(?:\.\d*)?|\.\d+)%?$/.test(parts[i])) return null;
            var percent = /%$/.test(parts[i]);
            values.push(parseFloat(parts[i]) * (percent ? (i === 3 ? 0.01 : 2.55) : 1));
        }
        var result = {r: values[0], g: values[1], b: values[2], a: parts.length === 4 ? values[3] : 1};
        return valid(result) ? result : null;
    }
    function composite(foreground, background) {
        var f = parse(foreground), b = parse(background);
        if (!f || !b || b.a !== 1) return null;
        return {r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a),
            b: f.b * f.a + b.b * (1 - f.a), a: 1};
    }
    function luminance(c) {
        function linear(x) { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
        return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
    }
    function contrast(foreground, background) {
        var b = parse(background), f = composite(foreground, b);
        if (!f || !b) return null;
        var x = luminance(f), y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    function toHSL(c) {
        var r = c.r / 255, g = c.g / 255, b = c.b / 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        var h = 0, l = (max + min) / 2, s = 0;
        if (d) {
            s = d / (1 - Math.abs(2 * l - 1));
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h = (h * 60 + 360) % 360;
        }
        return {h: h, s: s, l: l, a: c.a};
    }
    function fromHSL(c) {
        var chroma = (1 - Math.abs(2 * c.l - 1)) * c.s;
        var x = chroma * (1 - Math.abs((c.h / 60) % 2 - 1)), m = c.l - chroma / 2;
        var p = c.h < 60 ? [chroma, x, 0] : c.h < 120 ? [x, chroma, 0] :
            c.h < 180 ? [0, chroma, x] : c.h < 240 ? [0, x, chroma] :
            c.h < 300 ? [x, 0, chroma] : [chroma, 0, x];
        return {r: Math.round((p[0] + m) * 255), g: Math.round((p[1] + m) * 255),
            b: Math.round((p[2] + m) * 255), a: c.a};
    }
    function css(c) {
        var triple = [Math.round(c.r), Math.round(c.g), Math.round(c.b)].join(', ');
        return c.a === 1 ? 'rgb(' + triple + ')' : 'rgba(' + triple + ', ' + c.a + ')';
    }
    function result(original, colour, background, minimum, reason) {
        var ratio = contrast(colour, background);
        return {css: css(colour), rgba: copy(colour), contrast: ratio,
            meetsContrast: ratio >= minimum, changed: css(original) !== css(colour), reason: reason};
    }
    function moveToContrast(seed, background, minimum, endpoint) {
        var hsl = toHSL(seed), origin = hsl.l;
        hsl.l = endpoint;
        var best = fromHSL(hsl);
        if (contrast(best, background) < minimum) return best;
        var low = 0, high = 1;
        for (var i = 0; i < 24; i++) {
            var fraction = (low + high) / 2;
            hsl.l = origin + (endpoint - origin) * fraction;
            var candidate = fromHSL(hsl);
            if (contrast(candidate, background) >= minimum) { high = fraction; best = candidate; }
            else low = fraction;
        }
        return best;
    }
    function transform(foreground, background, minimum) {
        var original = parse(foreground), bg = parse(background);
        minimum = minimum === undefined ? 4.5 : minimum;
        if (!original || !bg || bg.a !== 1 || !number(minimum) || minimum < 1 || minimum > 21) return null;
        if (original.a === 0) return result(original, original, bg, minimum, 'transparent-preserved');
        var hsl = toHSL(original), neutral = hsl.s < 0.12, dark = luminance(bg) < 0.2;
        var originalContrast = contrast(original, bg), mapped = copy(original), reason = 'original-readable';
        if (dark && (neutral || originalContrast < minimum)) {
            if (neutral) hsl.s = 0;
            if (hsl.l <= 0.5) {
                var floor = !neutral && hsl.h > 205 && hsl.h < 245 ? 0.60 : MIN_LIGHTNESS;
                hsl.l = POLE + (floor - POLE) * hsl.l / 0.5;
            } else {
                hsl.l = clamp(hsl.l, MIN_LIGHTNESS, POLE);
            }
            mapped = fromHSL(hsl);
            reason = neutral ? 'neutral-dark-pole' : 'chromatic-dark-adaptation';
        }
        if (contrast(mapped, bg) < minimum) {
            var preferred = moveToContrast(mapped, bg, minimum, dark ? 1 : 0);
            var alternate = moveToContrast(mapped, bg, minimum, dark ? 0 : 1);
            if (contrast(preferred, bg) >= minimum) mapped = preferred;
            else if (contrast(alternate, bg) > contrast(preferred, bg)) mapped = alternate;
            else mapped = preferred;
            reason = 'contrast-adjustment';
        }
        return result(original, mapped, bg, minimum, reason);
    }
    return Object.freeze({parse: parse, composite: composite, contrast: contrast, transform: transform});
}));

