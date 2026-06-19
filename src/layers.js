// @ts-check

import { make_canvas } from "./helpers.js";

let next_layer_id = 1;

function make_layer_id() {
	return `layer-${next_layer_id++}`;
}

/**
 * Document model for bitmap layers.
 *
 * Layers are stored from bottom to top. For now the application adopts its
 * existing main canvas as the only layer; later changes can give the composed
 * view its own canvas without changing the layer model.
 */
class LayerDocument {
	/**
	 * @param {object} options
	 * @param {number} [options.width]
	 * @param {number} [options.height]
	 * @param {PixelCanvas} [options.initial_canvas]
	 * @param {PixelCanvas} [options.composite_canvas]
	 * @param {string} [options.initial_layer_name="Background"]
	 */
	constructor({ width, height, initial_canvas, composite_canvas, initial_layer_name = "Background" }) {
		if (!initial_canvas && (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1)) {
			throw new TypeError("LayerDocument requires an initial canvas or positive integer dimensions.");
		}

		/** @type {LayerDocumentLayer[]} */
		this.layers = [];
		/** @type {string} */
		this.active_layer_id = "";
		/** @type {PixelCanvas | undefined} */
		this.composite_canvas = composite_canvas;
		/** @type {((layer: LayerDocumentLayer) => void) | null} */
		this.on_active_layer_change = null;

		this.create_layer({
			name: initial_layer_name,
			canvas: initial_canvas ?? make_canvas(width, height),
		});
	}
	get width() {
		return this.layers[0].canvas.width;
	}
	get height() {
		return this.layers[0].canvas.height;
	}
	get active_layer() {
		const layer = this.layers.find(({ id }) => id === this.active_layer_id);
		if (!layer) {
			throw new Error(`Active layer not found: ${this.active_layer_id}`);
		}
		return layer;
	}
	/**
	 * Resizes every layer and the composite view.
	 *
	 * @param {number} width
	 * @param {number} height
	 * @param {object} [options]
	 * @param {boolean} [options.preserve=true]
	 */
	resize(width, height, { preserve = true } = {}) {
		if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
			throw new TypeError("Layer dimensions must be positive integers.");
		}
		for (const layer of this.layers) {
			const old_canvas = preserve ? make_canvas(layer.canvas) : null;
			layer.canvas.width = width;
			layer.canvas.height = height;
			layer.canvas.ctx.disable_image_smoothing();
			if (old_canvas) {
				layer.canvas.ctx.drawImage(old_canvas, 0, 0);
			}
		}
		if (this.composite_canvas) {
			this.composite_canvas.width = width;
			this.composite_canvas.height = height;
			this.composite_canvas.ctx.disable_image_smoothing();
		}
	}
	/**
	 * Appends a new topmost layer.
	 *
	 * @param {object} [options]
	 * @param {string} [options.name="Layer"]
	 * @param {PixelCanvas} [options.canvas]
	 * @returns {LayerDocumentLayer}
	 */
	create_layer({ name = "Layer", canvas = make_canvas(this.width, this.height) } = {}) {
		if (this.layers.length > 0 && (canvas.width !== this.width || canvas.height !== this.height)) {
			throw new RangeError("Layer dimensions must match the document dimensions.");
		}

		canvas.ctx.disable_image_smoothing();
		/** @type {LayerDocumentLayer} */
		const layer = {
			id: make_layer_id(),
			name,
			canvas,
			visible: true,
			opacity: 1,
			blend_mode: /** @type {GlobalCompositeOperation} */ ("source-over"),
			locked: false,
		};
		this.layers.push(layer);
		this.set_active_layer(layer.id);
		return layer;
	}
	/**
	 * @param {string} layer_id
	 * @returns {LayerDocumentLayer}
	 */
	set_active_layer(layer_id) {
		const layer = this.layers.find(({ id }) => id === layer_id);
		if (!layer) {
			throw new Error(`Layer not found: ${layer_id}`);
		}
		this.active_layer_id = layer.id;
		this.on_active_layer_change?.(layer);
		return layer;
	}
	/**
	 * Renders visible layers into a canvas, from bottom to top.
	 *
	 * @param {PixelCanvas} [target_canvas]
	 * @returns {PixelCanvas}
	 */
	render_composite(target_canvas = this.composite_canvas ?? make_canvas(this.width, this.height)) {
		const sole_layer = this.layers.length === 1 ? this.layers[0] : null;
		if (
			sole_layer &&
			target_canvas === sole_layer.canvas &&
			sole_layer.visible &&
			sole_layer.opacity === 1 &&
			sole_layer.blend_mode === "source-over"
		) {
			return target_canvas;
		}
		if (this.layers.some(({ canvas }) => canvas === target_canvas)) {
			throw new Error("Composite target cannot also be a layer canvas.");
		}

		if (target_canvas.width !== this.width) {
			target_canvas.width = this.width;
		}
		if (target_canvas.height !== this.height) {
			target_canvas.height = this.height;
		}
		const target_ctx = target_canvas.ctx;
		target_ctx.disable_image_smoothing();
		target_ctx.clearRect(0, 0, target_canvas.width, target_canvas.height);

		for (const layer of this.layers) {
			if (!layer.visible || layer.opacity <= 0) {
				continue;
			}
			target_ctx.save();
			target_ctx.globalAlpha = Math.min(1, layer.opacity);
			target_ctx.globalCompositeOperation = layer.blend_mode;
			target_ctx.drawImage(layer.canvas, 0, 0);
			target_ctx.restore();
		}

		return target_canvas;
	}
}

export { LayerDocument };

// Temporary global until app-state.js is converted to an ES Module.
window.LayerDocument = LayerDocument;
