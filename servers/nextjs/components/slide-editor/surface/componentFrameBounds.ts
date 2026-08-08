import type Konva from "konva";

type ClientRectConfig = Parameters<Konva.Group["getClientRect"]>[0];

const frameBoundNodes = new WeakSet<Konva.Group>();

export function constrainComponentTransformBounds(node: Konva.Group) {
  if (frameBoundNodes.has(node)) return;
  frameBoundNodes.add(node);
 // Konva ignores a Group's width/height when measuring it and unions its
     // descendants instead. Keep the component frame in that measurement, but
      // do not discard descendants: wrapped flex/grid content can legitimately
     // render outside the stored frame and the selection must cover it too.
      const getRenderedClientRect = node.getClientRect.bind(node);

  node.getClientRect = ((config: ClientRectConfig = {}) => {
    if (config.skipTransform) {
            const rendered = getRenderedClientRect(config);
        const left = Math.min(0, rendered.x);
       const top = Math.min(0, rendered.y);
        const right = Math.max(node.width(), rendered.x + rendered.width);
         const bottom = Math.max(node.height(), rendered.y + rendered.height);

      return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
    }
    return getRenderedClientRect(config);
  }) as Konva.Group["getClientRect"];
}
