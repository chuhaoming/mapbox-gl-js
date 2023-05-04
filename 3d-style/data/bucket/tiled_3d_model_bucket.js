// @flow

import {register} from '../../../src/util/web_worker_transfer.js';
import type {Bucket} from '../../../src/data/bucket.js';
import type {Node} from '../model.js';
import {uploadNode, destroyNodeArrays, destroyBuffers, ModelTraits} from '../model.js';
import type {EvaluationFeature} from '../../../src/data/evaluation_feature.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import type {CanonicalTileID} from '../../../src/source/tile_id.js';
import ModelStyleLayer from '../../style/style_layer/model_style_layer.js';
import type Context from '../../../src/gl/context.js';
import type {ProjectionSpecification} from '../../../src/style-spec/types.js';
import type Painter from '../../../src/render/painter.js';
import type {Vec4} from 'gl-matrix';

function getNodeHeight(node: Node): number {
    let height = 0;
    if (node.meshes) {
        for (const mesh of node.meshes) {
            height = Math.max(height, mesh.aabb.max[2]);
        }
    }
    if (node.children) {
        for (const child of node.children) {
            height = Math.max(height, getNodeHeight(child));
        }
    }
    return height;
}

export const PartNames = {
    wall : 1,
    door : 2,
    roof : 3,
    window : 4,
    lamp : 5,
    logo : 6
};

class Tiled3dModelFeature {
    feature: EvaluationFeature;
    evaluatedColor: Array<Vec4>;
    evaluatedRMEA: Array<Vec4>;
    evaluatedScale: [number, number, number];
    hiddenByReplacement: boolean;
    node: Node;
    id: CanonicalTileID;
    constructor(node: Node, tileId: CanonicalTileID) {
        this.id = tileId;
        this.node = node;
        this.evaluatedRMEA = [[1, 0, 0, 1],
            [1, 0, 0, 1],   // wall
            [1, 0, 0, 1],   // door
            [1, 0, 0, 1],   // roof
            [0.4, 1, 0, 1], // window
            [1, 0, 0, 1],   // lamp
            [1, 0, 0, 1]];  // logo
        this.hiddenByReplacement = false;
        this.evaluatedScale = [1, 1, 1];
        // Needs to calculate geometry
        this.feature = {type: 'Point', geometry: [], properties: {'height' : getNodeHeight(node)}};
    }
}

class Tiled3dModelBucket implements Bucket {
    nodes: Array<Node>;
    id: OverscaledTileID;
    uploaded: boolean;
    modelTraits: number;
    hasPattern: boolean;
    layers: Array<ModelStyleLayer>;
    layerIds: Array<string>;
    stateDependentLayers: Array<ModelStyleLayer>;
    stateDependentLayerIds: Array<string>;
    nodesInfo: Array<Tiled3dModelFeature>;
    zoom: number;
    projection: ProjectionSpecification;
    terrainTile: ?CanonicalTileID;
    terrainExaggeration: ?number;
    /* $FlowIgnore[incompatible-type-arg] Doesn't need to know about all the implementations */
    constructor(nodes: Array<Node>, id: OverscaledTileID, hasMbxMeshFeatures: boolean) {
        this.nodes = nodes;
        this.id = id;
        this.modelTraits |= ModelTraits.CoordinateSpaceTile;
        this.uploaded = false;
        this.hasPattern = false;
        if (hasMbxMeshFeatures) {
            this.modelTraits |= ModelTraits.HasMapboxMeshFeatures;
        }
        this.zoom = -1;
        this.terrainExaggeration = 1;
        this.projection = {name: 'mercator'};
    }
    update() {
        console.log("Update 3D model bucket");
    }
    populate() {
        console.log("populate 3D model bucket");
    }
    uploadPending(): boolean {
        return !this.uploaded;
    }

    upload(context: Context) {
        if (this.uploaded) return;
        for (const node of this.nodes) {
            uploadNode(node, context, true);
        }
        // Now destroy all buffers
        for (const node of this.nodes) {
            destroyNodeArrays(node);
        }
        this.uploaded = true;
    }

    needsReEvaluation(painter: Painter, demTile: ?CanonicalTileID): boolean {
        const zoom = painter.transform.zoom;
        const projection = painter.transform.projectionOptions;
        const exaggeration = painter.terrain ? painter.terrain.exaggeration() : 1;
        // Need to check if ModelLayer PaintProperties changed
        if (Math.floor(zoom) !== Math.floor(this.zoom) || projection.name !== this.projection.name ||
           demTile !== this.terrainTile || exaggeration !== this.terrainExaggeration) {
            this.zoom = zoom;
            this.projection = projection;
            this.terrainExaggeration = exaggeration;
            return true;
        }
        return false;
    }

    getNodesInfo(): Array<Tiled3dModelFeature> {
        if (!this.nodesInfo) {
            this.nodesInfo = [];
            for (const node of this.nodes) {
                this.nodesInfo.push(new Tiled3dModelFeature(node, this.id.canonical));
            }
        }
        return this.nodesInfo;
    }

    destroy() {
        for (const node of this.nodes) {
            destroyBuffers(node);
        }
    }

    isEmpty(): boolean {
        return !this.nodes.length;
    }

}

register(Tiled3dModelBucket, 'Tiled3dModelBucket', {omit: ['layers']});

export default Tiled3dModelBucket;