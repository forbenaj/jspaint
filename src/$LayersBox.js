// @ts-check
/* global $right, layer_document, localize */

import { $Component } from "./$Component.js";
import { deselect, undoable } from "./functions.js";
import { $G, E, make_canvas } from "./helpers.js";

/**
 * @returns {JQuery<HTMLDivElement> & I$Component}
 */
function $LayersBox() {
	const $box = $(E("div")).addClass("layers-box");
	const $list = $(E("div")).addClass("layers-list").attr({ role: "listbox", "aria-label": localize("Layers") }).appendTo($box);
	const $controls = $(E("div")).addClass("layers-controls").appendTo($box);

	const run_layer_action = (name, action) => {
		deselect();
		undoable({ name }, action);
	};
	const make_button = (action, label, title, handler) => {
		return $(E("button"))
			.attr({ type: "button", title, "data-layer-action": action })
			.text(label)
			.on("click", (event) => {
				event.stopPropagation();
				handler();
			})
			.appendTo($controls);
	};

	const $new = make_button("new", "+", localize("New Layer"), () => {
		run_layer_action(localize("New Layer"), () => {
			layer_document.create_layer({ name: `${localize("Layer")} ${layer_document.layers.length + 1}` });
		});
	});
	const $duplicate = make_button("duplicate", "⧉", localize("Duplicate Layer"), () => {
		run_layer_action(localize("Duplicate Layer"), () => {
			layer_document.duplicate_layer(layer_document.active_layer_id);
		});
	});
	const $delete = make_button("delete", "×", localize("Delete Layer"), () => {
		run_layer_action(localize("Delete Layer"), () => {
			layer_document.remove_layer(layer_document.active_layer_id);
		});
	});
	const $up = make_button("up", "↑", localize("Move Layer Up"), () => {
		run_layer_action(localize("Move Layer Up"), () => {
			const index = layer_document.layers.findIndex(({ id }) => id === layer_document.active_layer_id);
			layer_document.move_layer(layer_document.active_layer_id, index + 1);
		});
	});
	const $down = make_button("down", "↓", localize("Move Layer Down"), () => {
		run_layer_action(localize("Move Layer Down"), () => {
			const index = layer_document.layers.findIndex(({ id }) => id === layer_document.active_layer_id);
			layer_document.move_layer(layer_document.active_layer_id, index - 1);
		});
	});

	const render = () => {
		$list.empty();
		for (const layer of [...layer_document.layers].reverse()) {
			const visibility_id = `layer-visibility-${layer.id}`;
			const $row = $(E("div"))
				.addClass("layer-row")
				.toggleClass("selected", layer.id === layer_document.active_layer_id)
				.attr({ role: "option", "aria-selected": layer.id === layer_document.active_layer_id ? "true" : "false", "data-layer-id": layer.id })
				.on("click", () => {
					if (layer.id !== layer_document.active_layer_id) {
						deselect();
						layer_document.set_active_layer(layer.id);
					}
				})
				.appendTo($list);
			const $visible = $(E("input"))
				.attr({ id: visibility_id, type: "checkbox" })
				.prop("checked", layer.visible)
				.on("click", (event) => event.stopPropagation())
				.on("change", () => {
					run_layer_action(localize("Show/Hide Layer"), () => {
						layer_document.update_layer(layer.id, { visible: $visible.prop("checked") });
					});
				})
				.appendTo($row);
			$(E("label"))
				.addClass("layer-visibility-toggle")
				.attr({ for: visibility_id, title: localize("Show/Hide Layer") })
				.on("click", (event) => event.stopPropagation())
				.appendTo($row);
			const thumbnail = make_canvas(40, 30);
			thumbnail.classList.add("layer-thumbnail");
			thumbnail.ctx.disable_image_smoothing();
			const scale = Math.min(thumbnail.width / layer.canvas.width, thumbnail.height / layer.canvas.height);
			const width = Math.max(1, Math.round(layer.canvas.width * scale));
			const height = Math.max(1, Math.round(layer.canvas.height * scale));
			thumbnail.ctx.drawImage(layer.canvas, Math.floor((thumbnail.width - width) / 2), Math.floor((thumbnail.height - height) / 2), width, height);
			$row.append(thumbnail);
			$(E("input"))
				.addClass("layer-name")
				.attr({ type: "text", "aria-label": localize("Layer Name") })
				.val(layer.name)
				.on("click", (event) => event.stopPropagation())
				.on("change", (event) => {
					const name = $(event.currentTarget).val().toString().trim();
					if (name && name !== layer.name) {
						run_layer_action(localize("Rename Layer"), () => {
							layer_document.update_layer(layer.id, { name });
						});
					} else {
						render();
					}
				})
				.appendTo($row);
		}

		const active_index = layer_document.layers.findIndex(({ id }) => id === layer_document.active_layer_id);
		$new.prop("disabled", false);
		$duplicate.prop("disabled", active_index < 0);
		$delete.prop("disabled", layer_document.layers.length < 2);
		$up.prop("disabled", active_index === layer_document.layers.length - 1);
		$down.prop("disabled", active_index <= 0);
	};

	const $component = /** @type {JQuery<HTMLDivElement> & I$Component} */ (
		$Component(localize("Layers"), "layers-component", "tall", $box)
	);
	$component.appendTo($right);
	$G.on("layers-change session-update", render);
	render();
	return $component;
}

export { $LayersBox };
