/// <reference types="Cypress" />

context("layer preview tests", () => {
	const trigger_pointer = (win, target, type, x, y, buttons) => {
		const rect = target.getBoundingClientRect();
		win.$(target).trigger(new win.$.Event(type, {
			view: win,
			bubbles: true,
			cancelable: true,
			clientX: rect.left + x,
			clientY: rect.top + y,
			button: 0,
			buttons,
			pointerType: "mouse",
		}));
	};

	beforeEach(() => {
		cy.visit("/");
		cy.window().should("have.property", "layer_document");
	});

	it("composites an active lower-layer stroke below upper layers", () => {
		cy.window().then((win) => {
			const document_model = win.layer_document;
			const lower_layer = document_model.active_layer;
			const upper_layer = document_model.create_layer({ name: "Upper" });
			upper_layer.canvas.ctx.fillStyle = "red";
			upper_layer.canvas.ctx.fillRect(0, 0, 30, 30);
			document_model.set_active_layer(lower_layer.id);
			document_model.render_composite();

			win.$('.tool[title="Pencil"]').trigger("click");
			const main_canvas = document_model.composite_canvas;
			trigger_pointer(win, main_canvas, "pointerenter", 10, 10, 0);
			trigger_pointer(win, main_canvas, "pointerdown", 10, 10, 1);
			trigger_pointer(win, main_canvas, "pointermove", 11, 10, 1);
		});
		cy.wait(50);
		cy.window().then((win) => {
			const helper_canvas = win.document.querySelector(".helper-layer canvas");
			const helper_rect = helper_canvas.getBoundingClientRect();
			const scale = helper_canvas.width / helper_rect.width;
			const pixel = [...helper_canvas.ctx.getImageData(Math.floor(10 * scale), Math.floor(10 * scale), 1, 1).data];
			expect(pixel).to.deep.equal([255, 0, 0, 255]);
			expect(win.document.querySelector(".main-canvas").style.opacity).to.equal("0");
		});
	});
});
