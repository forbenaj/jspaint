/// <reference types="Cypress" />

context("layer document tests", () => {
	beforeEach(() => {
		cy.visit("/");
		cy.window().should("have.property", "layer_document");
	});

	it("adopts the existing main canvas as the initial layer", () => {
		cy.window().then((win) => {
			const document_model = win.layer_document;
			const main_canvas = win.document.querySelector(".main-canvas");

			expect(document_model.layers).to.have.length(1);
			expect(document_model.active_layer).to.equal(document_model.layers[0]);
			expect(document_model.active_layer.canvas).to.equal(main_canvas);
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
});
