/// <reference types="Cypress" />

context("layer document tests", () => {
	const trigger_pointer = (win, target, type, point, buttons) => {
		win.$(target).trigger(new win.$.Event(type, {
			view: win,
			bubbles: true,
			cancelable: true,
			clientX: point.x,
			clientY: point.y,
			button: 0,
			buttons,
			pointerType: "mouse",
		}));
	};
	const canvas_point_to_client = (target, x, y) => {
		const rect = target.getBoundingClientRect();
		return { x: rect.left + x, y: rect.top + y };
	};

	beforeEach(() => {
		cy.visit("/");
		cy.window().should("have.property", "layer_document");
	});

	it("keeps the editable layer separate from the composite canvas", () => {
		cy.window().then((win) => {
			const document_model = win.layer_document;
			const main_canvas = win.document.querySelector(".main-canvas");

			expect(document_model.layers).to.have.length(1);
			expect(document_model.active_layer).to.equal(document_model.layers[0]);
			expect(document_model.active_layer.canvas).not.to.equal(main_canvas);
			expect(document_model.composite_canvas).to.equal(main_canvas);
			expect(document_model.width).to.equal(main_canvas.width);
			expect(document_model.height).to.equal(main_canvas.height);
		});
	});

	it("composites visible layers from bottom to top", () => {
		cy.window().then((win) => {
			const bottom_canvas = win.make_canvas(1, 1);
			bottom_canvas.ctx.fillStyle = "rgb(255, 0, 0)";
			bottom_canvas.ctx.fillRect(0, 0, 1, 1);

			const document_model = new win.LayerDocument({ initial_canvas: bottom_canvas });
			const top_layer = document_model.create_layer({ name: "Top" });
			top_layer.canvas.ctx.fillStyle = "rgb(0, 0, 255)";
			top_layer.canvas.ctx.fillRect(0, 0, 1, 1);
			top_layer.opacity = 0.5;

			const result = document_model.render_composite();
			const pixel = [...result.ctx.getImageData(0, 0, 1, 1).data];
			expect(pixel).to.deep.equal([127, 0, 128, 255]);

			top_layer.visible = false;
			document_model.render_composite(result);
			const hidden_pixel = [...result.ctx.getImageData(0, 0, 1, 1).data];
			expect(hidden_pixel).to.deep.equal([255, 0, 0, 255]);
		});
	});

	it("resizes every layer while preserving existing pixels", () => {
		cy.window().then((win) => {
			const bottom_canvas = win.make_canvas(2, 2);
			bottom_canvas.ctx.fillStyle = "red";
			bottom_canvas.ctx.fillRect(0, 0, 1, 1);
			const document_model = new win.LayerDocument({ initial_canvas: bottom_canvas });
			const top_layer = document_model.create_layer({ name: "Top" });
			top_layer.canvas.ctx.fillStyle = "blue";
			top_layer.canvas.ctx.fillRect(1, 1, 1, 1);

			document_model.resize(3, 4);

			expect(document_model.width).to.equal(3);
			expect(document_model.height).to.equal(4);
			for (const layer of document_model.layers) {
				expect(layer.canvas.width).to.equal(3);
				expect(layer.canvas.height).to.equal(4);
			}
			expect([...bottom_canvas.ctx.getImageData(0, 0, 1, 1).data]).to.deep.equal([255, 0, 0, 255]);
			expect([...top_layer.canvas.ctx.getImageData(1, 1, 1, 1).data]).to.deep.equal([0, 0, 255, 255]);
		});
	});

	it("renders tool edits from the active layer into the composite canvas", () => {
		cy.window().then((win) => {
			const document_model = win.layer_document;
			const main_canvas = win.document.querySelector(".main-canvas");
			const start = canvas_point_to_client(main_canvas, 20, 20);
			const end = canvas_point_to_client(main_canvas, 23, 23);

			trigger_pointer(win, main_canvas, "pointerenter", start, 0);
			trigger_pointer(win, main_canvas, "pointerdown", start, 1);
			trigger_pointer(win, main_canvas, "pointermove", end, 1);
			trigger_pointer(win, main_canvas, "pointerup", end, 0);

			const active_pixel = [...document_model.active_layer.canvas.ctx.getImageData(20, 20, 1, 1).data];
			const composite_pixel = [...main_canvas.ctx.getImageData(20, 20, 1, 1).data];
			expect(active_pixel).to.deep.equal([0, 0, 0, 255]);
			expect(composite_pixel).to.deep.equal(active_pixel);
		});
	});

	it("samples colors from the composite instead of only the active layer", () => {
		cy.window().then((win) => {
			const document_model = win.layer_document;
			const bottom_layer = document_model.active_layer;
			bottom_layer.canvas.ctx.fillStyle = "red";
			bottom_layer.canvas.ctx.fillRect(0, 0, 30, 30);
			const top_layer = document_model.create_layer({ name: "Top" });
			top_layer.canvas.ctx.fillStyle = "blue";
			top_layer.canvas.ctx.fillRect(0, 0, 30, 30);
			document_model.set_active_layer(bottom_layer.id);
			document_model.render_composite();

			win.$('.tool[title="Pick Color"]').trigger("click");
			const main_canvas = document_model.composite_canvas;
			const point = canvas_point_to_client(main_canvas, 10, 10);
			trigger_pointer(win, main_canvas, "pointerenter", point, 0);
			trigger_pointer(win, main_canvas, "pointerdown", point, 1);
			trigger_pointer(win, main_canvas, "pointerup", point, 0);

			expect(win.api_for_cypress_tests.selected_colors.foreground).to.equal("rgba(0,0,255,1)");
		});
	});

	it("cuts selections from the active layer instead of the composite", () => {
		cy.window().then((win) => {
			const document_model = win.layer_document;
			const bottom_layer = document_model.active_layer;
			bottom_layer.canvas.ctx.fillStyle = "red";
			bottom_layer.canvas.ctx.fillRect(0, 0, 40, 40);
			const top_layer = document_model.create_layer({ name: "Top" });
			top_layer.canvas.ctx.fillStyle = "blue";
			top_layer.canvas.ctx.fillRect(0, 0, 40, 40);
			document_model.set_active_layer(bottom_layer.id);
			document_model.render_composite();

			win.$('.tool[title="Select"]').trigger("click");
			const main_canvas = document_model.composite_canvas;
			const start = canvas_point_to_client(main_canvas, 10, 10);
			const end = canvas_point_to_client(main_canvas, 20, 20);
			trigger_pointer(win, main_canvas, "pointerenter", start, 0);
			trigger_pointer(win, main_canvas, "pointerdown", start, 1);
			trigger_pointer(win, main_canvas, "pointermove", end, 1);
			trigger_pointer(win, main_canvas, "pointerup", end, 0);

			const selection_canvas = win.document.querySelector(".selection canvas");
			const selected_pixel = [...selection_canvas.getContext("2d").getImageData(1, 1, 1, 1).data];
			expect(selected_pixel).to.deep.equal([255, 0, 0, 255]);
		});
	});
});
