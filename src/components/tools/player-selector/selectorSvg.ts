export const makeSvgNode = (tag: string, attrs: Record<string, unknown>): SVGElement => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, String(value));
    }
    return el;
};
