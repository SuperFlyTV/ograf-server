# Layer-based renderer

This is a basic Renderer that renders Graphics on layers.

- Graphics are rendered in realtime.
- It has no Renderer-specific actions
- It exposes 10 RenderTargets (ie "Layers")
- Each Layer can have 0 or 1 GraphicInstance playing
- If loading a new GraphicInstance on a Layer, the previous one is cleared
