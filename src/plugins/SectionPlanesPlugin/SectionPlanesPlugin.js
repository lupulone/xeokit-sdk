import {math} from "../../viewer/scene/math/math.js";
import {Plugin} from "../../viewer/Plugin.js";
import {SectionPlane} from "../../viewer/scene/sectionPlane/SectionPlane.js";
import {Control} from "./Control.js";
import {Overview} from "./Overview.js";

const tempAABB = math.AABB3();
const tempVec3 = math.vec3();

/**
 * {@link Viewer} plugin that manages {@link SectionPlane}s.
 *
 * Use the SectionPlanesPlugin to create and edit {@link SectionPlane}s, which slice portions off your models to reveal internal structures.
 *
 * The SectionPlanesPlugin shows an overview of your SectionPlanes in a canvas in the corner
 * of the {@link Viewer}'s canvas. Click the planes in the overview canvas to activate a 3D editing control with
 * which you can interactively reposition them in the Viewer canvas.
 *
 * ## Usage
 *
 * * [[Run this example](https://xeokit.github.io/xeokit-sdk/examples/#gizmos_SectionPlanesPlugin)]
 *
 * In the example below, we'll use a {@link GLTFLoaderPlugin} to load a model, and a SectionPlanesPlugin
 * to slice it open with two {@link SectionPlane}s. We'll show the overview in the bottom right of the Viewer
 * canvas. Finally, we'll programmatically activate the 3D editing control for our second plane.
 *
 * ````JavaScript
 * import {Viewer} from "../src/viewer/Viewer.js";
 * import {GLTFLoaderPlugin} from "../src/plugins/GLTFLoaderPlugin/GLTFLoaderPlugin.js";
 * import {SectionPlanesPlugin} from "../src/plugins/SectionPlanesPlugin/SectionPlanesPlugin.js";
 *
 * // Create a Viewer and arrange its Camera
 *
 * const viewer = new Viewer({
 *     canvasId: "myCanvas"
 * });
 *
 * viewer.camera.eye = [-5.02, 2.22, 15.09];
 * viewer.camera.look = [4.97, 2.79, 9.89];
 * viewer.camera.up = [-0.05, 0.99, 0.02];
 *
 *
 * // Add a GLTFLoaderPlugin
 *
 * const gltfLoader = new GLTFLoaderPlugin(viewer);
 *
 * // Add a SectionPlanesPlugin, with overview visible
 *
 * const sectionPlanes = new SectionPlanesPlugin(viewer, {
 *     overviewCanvasID: "myOverviewCanvas",
 *     overviewVisible: true
 * });
 *
 * // Load a model
 *
 * const model = gltfLoader.load({
 *     id: "myModel",
 *     src: "./models/gltf/schependomlaan/scene.gltf"
 * });
 *
 * // Create a couple of section planes
 * // These will be shown in the overview
 *
 * sectionPlanes.createSectionPlane({
 *     id: "mySectionPlane",
 *     pos: [1.04, 1.95, 9.74],
 *     dir: [1.0, 0.0, 0.0]
 * });
 *
 * sectionPlanes.createSectionPlane({
 *     id: "mySectionPlane2",
 *     pos: [2.30, 4.46, 14.93],
 *     dir: [0.0, -0.09, -0.79]
 * });
 *
 * // Show the SectionPlanePlugin's 3D editing gizmo,
 * // to interactively reposition one of our SectionPlanes
 *
 * sectionPlanes.showControl("mySectionPlane2");
 *
 * const mySectionPlane2 = sectionPlanes.sectionPlanes["mySectionPlane2"];
 *
 * // Programmatically reposition one of our SectionPlanes
 * // This also updates its position as shown in the overview gizmo
 *
 * mySectionPlane2.pos = [11.0, 6.-, -12];
 * mySectionPlane2.dir = [0.4, 0.0, 0.5];
 * ````
 */
class SectionPlanesPlugin extends Plugin {

    /**
     * @constructor
     * @param {Viewer} viewer The Viewer.
     * @param {Object} cfg Plugin configuration.
     * @param {String} [cfg.id="SectionPlanes"] Optional ID for this plugin, so that we can find it within {@link Viewer#plugins}.
     * @param {String} cfg.overviewCanvasId ID of a canvas element to display the overview.
     * @param {String} [cfg.overviewVisible=true] Initial visibility of the overview canvas.
     */
    constructor(viewer, cfg = {}) {

        super("SectionPlanes", viewer);

        this._freeControls = [];
        this._sectionPlanes = viewer.scene.sectionPlanes;
        this._controls = {};
        this._shownControlId = null;

        if (!cfg.overviewCanvasId) {

            this.error("Config missing: overviewCanvasId - will create plugin without overview");

        } else {

            const overviewCanvas = document.getElementById(cfg.overviewCanvasId);
            if (!overviewCanvas) {
                this.error("Can't find overview canvas: '" + cfg.overviewCanvasId + "' - will create plugin without overview");
                return;
            }

            this._overview = new Overview(this, {
                overviewCanvas: overviewCanvas,
                visible: cfg.overviewVisible,

                onHoverEnterPlane: ((id) => {
                    this._overview._setPlaneHighlighted(id, true);
                }),

                onHoverLeavePlane: ((id) => {
                    this._overview._setPlaneHighlighted(id, false);
                }),

                onClickedPlane: ((id) => {
                    if (this.getShownControl() === id) {
                        this.hideControl();
                        return;
                    }
                    this.showControl(id);
                    const sectionPlane = this.sectionPlanes[id];
                    const sectionPlanePos = sectionPlane.pos;
                    tempAABB.set(this.viewer.scene.aabb);
                    math.getAABB3Center(tempAABB, tempVec3);
                    tempAABB[0] += sectionPlanePos[0] - tempVec3[0];
                    tempAABB[1] += sectionPlanePos[1] - tempVec3[1];
                    tempAABB[2] += sectionPlanePos[2] - tempVec3[2];
                    tempAABB[3] += sectionPlanePos[0] - tempVec3[0];
                    tempAABB[4] += sectionPlanePos[1] - tempVec3[1];
                    tempAABB[5] += sectionPlanePos[2] - tempVec3[2];
                    this.viewer.cameraFlight.flyTo({
                        aabb: tempAABB,
                        fitFOV: 65
                    });
                }),

                onClickedNothing: (() => {
                    this.hideControl();
                })
            });
        }
    }

    /**
     * Sets if the overview canvas is visible.
     *
     * @param {Boolean} visible Whether or not the overview canvas is visible.
     */
    setOverviewVisible(visible) {
        if (this._overview) {
            this._overview.setVisible(visible);
        }
    }

    /**
     * Gets if the overview canvas is visible.
     *
     * @return {Boolean} True when the overview canvas is visible.
     */
    getOverviewVisible() {
        if (this._overview) {
            return this._overview.getVisible();
        }
    }

    /**
     * Returns a map of the {@link SectionPlane}s created by this SectionPlanesPlugin.
     *
     * @returns {{String:SectionPlane}} A map containing the {@link SectionPlane}s, each mapped to its {@link SectionPlane#id}.
     */
    get sectionPlanes() {
        return this._sectionPlanes;
    }

    /**
     * Creates a {@link SectionPlane}.
     *
     * The {@link SectionPlane} will be registered by {@link SectionPlane#id} in {@link SectionPlanesPlugin#sectionPlanes}.
     *
     * @param {Object} params {@link SectionPlane} configuration.
     * @param {String} [params.id] Unique ID to assign to the {@link SectionPlane}. Must be unique among all components in the {@link Viewer}'s {@link Scene}. Auto-generated when omitted.
     * @param {Number[]} [params.pos=0,0,0] World-space position of the {@link SectionPlane}.
     * @param {Number[]} [params.dir=[0,0,-1]} World-space vector indicating the orientation of the {@link SectionPlane}.
     * @param {Boolean} [params.active=true] Whether the {@link SectionPlane} is initially active. Only clips while this is true.
     * @returns {SectionPlane} The new {@link SectionPlane}.
     */
    createSectionPlane(params) {
        if (params.id !== undefined && params.id !== null && this.viewer.scene.components[params.id]) {
            this.error("Viewer component with this ID already exists: " + params.id);
            delete params.id;
        }
        const sectionPlane = new SectionPlane(this.viewer.scene, {
            id: params.id,
            pos: params.pos,
            dir: params.dir,
            active: true || params.active
        });
        const control = (this._freeControls.length > 0) ? this._freeControls.pop() : new Control(this);
        control._setSectionPlane(sectionPlane);
        control.setVisible(false);
        this._controls[sectionPlane.id] = control;
        if (this._overview) {
            this._overview._addSectionPlane(sectionPlane);
        }
        return sectionPlane;
    }

    /**
     * Shows the 3D editing gizmo for a {@link SectionPlane}.
     *
     * @param {String} id ID of the {@link SectionPlane}.
     */
    showControl(id) {
        const control = this._controls[id];
        if (!control) {
            this.error("Control not found: " + id);
            return;
        }
        this.hideControl();
        control.setVisible(true);
        if (this._overview) {
            this._overview._setPlaneSelected(id, true);
        }
        this._shownControlId = id;
    }

    /**
     * Gets the ID of the {@link SectionPlane} that the 3D editing gizmo is shown for.
     *
     * Returns ````null```` when the editing gizmo is not shown.
     *
     * @returns {String} ID of the the {@link SectionPlane} that the 3D editing gizmo is shown for, if shown, else ````null````.
     */
    getShownControl() {
        return this._shownControlId;
    }

    /**
     * Hides the 3D {@link SectionPlane} editing gizmo if shown.
     */
    hideControl() {
        for (var id in this._controls) {
            if (this._controls.hasOwnProperty(id)) {
                this._controls[id].setVisible(false);
                if (this._overview) {
                    this._overview._setPlaneSelected(id, false);
                }
            }
        }
        this._shownControlId = null;
    }

    /**
     * Destroys a {@link SectionPlane} created by this SectionPlanesPlugin.
     *
     * @param {String} id ID of the {@link SectionPlane}.
     */
    destroySectionPlane(id) {
        var sectionPlane = this.viewer.scene.sectionPlanes[id];
        if (!sectionPlane) {
            this.error("SectionPlane not found: " + id);
            return;
        }
        if (this._overview) {
            this._overview._removeSectionPlane(sectionPlane);
        }
        sectionPlane.destroy();
        const control = this._controls[id];
        if (!control) {
            return;
        }
        control.setVisible(false);
        control._setSectionPlane(null);
        delete this._controls[sectionPlane.id];
        this._freeControls.push(control);
    }

    /**
     * Destroys all {@link SectionPlane}s created by this SectionPlanesPlugin.
     */
    clear() {
        const ids = Object.keys(this._sectionPlanes);
        for (var i = 0, len = ids.length; i < len; i++) {
            this.destroySectionPlane(ids[i]);
        }
    }

    /**
     * @private
     */
    send(name, value) {
        switch (name) {
            case "clearSectionPlanes":
                this.clear();
                break;
        }
    }

    /**
     * Destroys this SectionPlanesPlugin.
     *
     * Also destroys each {@link SectionPlane} created by this SectionPlanesPlugin.
     */
    destroy() {
        this.clear();
        if (this._overview) {
            this._overview._destroy();
        }
        this._destroyFreeControls();
        super.destroy();
    }

    _destroyFreeControls() {
        var control = this._freeControls.pop();
        while (control) {
            control._destroy();
            control = this._freeControls.pop();
        }
    }
}

export {SectionPlanesPlugin}