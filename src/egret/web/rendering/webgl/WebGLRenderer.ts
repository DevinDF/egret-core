//////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (c) 2014-present, Egret Technology.
//  All rights reserved.
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the Egret nor the
//       names of its contributors may be used to endorse or promote products
//       derived from this software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY EGRET AND CONTRIBUTORS "AS IS" AND ANY EXPRESS
//  OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
//  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
//  IN NO EVENT SHALL EGRET AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
//  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;LOSS OF USE, DATA,
//  OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
//  LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
//  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
//  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
//////////////////////////////////////////////////////////////////////////////////////

namespace egret.web {

    let blendModes = ["source-over", "lighter", "destination-out"];
    let defaultCompositeOp = "source-over";
    let BLACK_COLOR = "#000000";
    let CAPS_STYLES = { none: 'butt', square: 'square', round: 'round' };
    let renderBufferPool: WebGLRenderBuffer[] = [];//渲染缓冲区对象池
    /**
     * @private
     * WebGL渲染器
     */
    export class WebGLRenderer implements sys.SystemRenderer {

        public constructor() {

        }

        private nestLevel: number = 0;//渲染的嵌套层次，0表示在调用堆栈的最外层。
        /**
         * 渲染一个显示对象
         * @param displayObject 要渲染的显示对象
         * @param buffer 渲染缓冲
         * @param matrix 要对显示对象整体叠加的变换矩阵
         * @param dirtyList 脏矩形列表
         * @param forRenderTexture 绘制目标是RenderTexture的标志
         * @returns drawCall触发绘制的次数
         */
        public render(displayObject: DisplayObject, buffer: sys.RenderBuffer, matrix: Matrix, forRenderTexture?: boolean): number {
            this.nestLevel++;
            let webglBuffer: WebGLRenderBuffer = <WebGLRenderBuffer>buffer;
            let webglBufferContext: WebGLRenderContext = webglBuffer.context;
            let root: DisplayObject = forRenderTexture ? displayObject : null;

            webglBufferContext.pushBuffer(webglBuffer);

            //绘制显示对象
            webglBuffer.transform(matrix.a, matrix.b, matrix.c, matrix.d, 0, 0);
            /*
            *****
            */
            this.__setTransform__(displayObject, webglBuffer, matrix.tx, matrix.ty, true);
            /*
            *****
            */
            this.drawDisplayObject(displayObject, webglBuffer, matrix.tx, matrix.ty, true);
            webglBufferContext.$drawWebGL();
            let drawCall = webglBuffer.$drawCalls;
            webglBuffer.onRenderFinish();

            webglBufferContext.popBuffer();
            let invert = Matrix.create();
            matrix.$invertInto(invert);
            webglBuffer.transform(invert.a, invert.b, invert.c, invert.d, 0, 0);
            Matrix.release(invert);

            this.nestLevel--;
            if (this.nestLevel === 0) {
                //最大缓存6个渲染缓冲
                if (renderBufferPool.length > 6) {
                    renderBufferPool.length = 6;
                }
                let length = renderBufferPool.length;
                for (let i = 0; i < length; i++) {
                    renderBufferPool[i].resize(0, 0);
                }
            }
            return drawCall;
        }

        /**
         * @private
         * 绘制一个显示对象
         */
        private drawDisplayObject(displayObject: DisplayObject, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number, isStage?: boolean): number {
            let drawCalls = 0;
            let node: sys.RenderNode;
            // let displayList = displayObject.$displayList;
            // if (displayList && !isStage) {
            //     if (displayObject.$cacheDirty || displayObject.$renderDirty ||
            //         displayList.$canvasScaleX != sys.DisplayList.$canvasScaleX ||
            //         displayList.$canvasScaleY != sys.DisplayList.$canvasScaleY) {
            //         drawCalls += displayList.drawToSurface();
            //     }
            //     node = displayList.$renderNode;
            // }
            // else {
            //     if (displayObject.$renderDirty) {
            //         node = displayObject.$getRenderNode();
            //     }
            //     else {
            //         node = displayObject.$renderNode;
            //     }
            // }
            node = displayObject.$getRenderNode();
            displayObject.$cacheDirty = false;
            if (node) {
                drawCalls++;
                buffer.$offsetX = offsetX;
                buffer.$offsetY = offsetY;
                /*
                *************************************************
                */
                if (!NumberUtils.matrixEqual(buffer.globalMatrix, displayObject.transform.globalMatrix)
                    || buffer.$offsetX !== displayObject.transform.offsetX
                    || buffer.$offsetY !== displayObject.transform.offsetY) {
                    console.error('drawDisplayObject transform error');
                }
                egret.sys.debugRenderNode = node;

                //渲染之前，先将object的globalMatrix设置给node
                // const transform = displayObject.transform;
                // const textureTransform = node.textureTransform;
                // textureTransform.globalMatrix.copyFrom(transform.globalMatrix);
                // textureTransform.offsetX = transform.offsetX;
                // textureTransform.offsetY = transform.offsetY;
                this.__calculateVertices__(displayObject, node, buffer, displayObject.transform);

                /*
                switch (node.type) {
                    case sys.RenderNodeType.BitmapNode:
                        this.__transformBitmap__(displayObject, <sys.BitmapNode>node, buffer);
                        break;
                    case sys.RenderNodeType.TextNode:
                        this.__transformText__(displayObject, <sys.TextNode>node, buffer);
                        break;
                    case sys.RenderNodeType.GraphicsNode:
                        this.__transformGraphics__(displayObject, <sys.GraphicsNode>node, buffer);
                        break;
                    case sys.RenderNodeType.GroupNode:
                        this.__transformGroup__(displayObject, <sys.GroupNode>node, buffer);
                        break;
                    case sys.RenderNodeType.MeshNode:
                        this.__transformMesh__(displayObject, <sys.MeshNode>node, buffer);
                        break;
                    case sys.RenderNodeType.NormalBitmapNode:
                        this.__transformNormalBitmap__(displayObject, <sys.NormalBitmapNode>node, buffer);
                        break;
                }
                */
                /*
                *************************************************
                */
                switch (node.type) {
                    case sys.RenderNodeType.BitmapNode:
                        this.renderBitmap(<sys.BitmapNode>node, buffer);
                        break;
                    case sys.RenderNodeType.TextNode:
                        this.renderText(<sys.TextNode>node, buffer);
                        break;
                    case sys.RenderNodeType.GraphicsNode:
                        this.renderGraphics(<sys.GraphicsNode>node, buffer);
                        break;
                    case sys.RenderNodeType.GroupNode:
                        this.renderGroup(displayObject, <sys.GroupNode>node, buffer);
                        break;
                    case sys.RenderNodeType.MeshNode:
                        this.renderMesh(<sys.MeshNode>node, buffer);
                        break;
                    case sys.RenderNodeType.NormalBitmapNode:
                        this.renderNormalBitmap(<sys.NormalBitmapNode>node, buffer);
                        break;
                }
                buffer.$offsetX = 0;
                buffer.$offsetY = 0;
            }
            // if (displayList && !isStage) {
            //     return drawCalls;
            // }
            let children = displayObject.$children;
            if (children) {
                let length = children.length;
                for (let i = 0; i < length; i++) {
                    let child = children[i];
                    let offsetX2 = 0;
                    let offsetY2 = 0;
                    let tempAlpha = 0;
                    if (child.$alpha !== 1) {
                        tempAlpha = buffer.globalAlpha;
                        buffer.globalAlpha *= child.$alpha;
                    }
                    let savedMatrix: Matrix;
                    let m = child.$getMatrix();
                    if (child.$useTranslate || true) {
                        // let m = child.$getMatrix();
                        // offsetX2 = offsetX + child.$x;
                        // offsetY2 = offsetY + child.$y;
                        let m2 = buffer.globalMatrix;
                        savedMatrix = Matrix.create();
                        savedMatrix.a = m2.a;
                        savedMatrix.b = m2.b;
                        savedMatrix.c = m2.c;
                        savedMatrix.d = m2.d;
                        savedMatrix.tx = m2.tx;
                        savedMatrix.ty = m2.ty;
                        //buffer.transform(m.a, m.b, m.c, m.d, offsetX2, offsetY2);
                        buffer.transform(m.a, m.b, m.c, m.d, offsetX + m.tx, offsetY + m.ty);
                        offsetX2 = -child.$anchorOffsetX;
                        offsetY2 = -child.$anchorOffsetY;
                    }
                    else {
                        // offsetX2 = offsetX + child.$x - child.$anchorOffsetX;
                        // offsetY2 = offsetY + child.$y - child.$anchorOffsetY;
                        offsetX2 = offsetX + m.tx - child.$anchorOffsetX;
                        offsetY2 = offsetY + m.ty - child.$anchorOffsetY;
                    }
                    switch (child.$renderMode) {
                        case RenderMode.NONE:
                            break;
                        case RenderMode.FILTER:
                            drawCalls += this.drawWithFilter(child, buffer, offsetX2, offsetY2);
                            break;
                        case RenderMode.CLIP:
                            drawCalls += this.drawWithClip(child, buffer, offsetX2, offsetY2);
                            break;
                        case RenderMode.SCROLLRECT:
                            drawCalls += this.drawWithScrollRect(child, buffer, offsetX2, offsetY2);
                            break;
                        default:
                            drawCalls += this.drawDisplayObject(child, buffer, offsetX2, offsetY2);
                            break;
                    }
                    if (tempAlpha) {
                        buffer.globalAlpha = tempAlpha;
                    }
                    if (savedMatrix) {
                        let m = buffer.globalMatrix;
                        m.a = savedMatrix.a;
                        m.b = savedMatrix.b;
                        m.c = savedMatrix.c;
                        m.d = savedMatrix.d;
                        m.tx = savedMatrix.tx;
                        m.ty = savedMatrix.ty;
                        Matrix.release(savedMatrix);
                    }
                }
            }
            return drawCalls;
        }

        /**
         * @private
         */
        private drawWithFilter(displayObject: DisplayObject, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number): number {
            let drawCalls = 0;
            if (displayObject.$children && displayObject.$children.length == 0 && (!displayObject.$renderNode || displayObject.$renderNode.$getRenderCount() == 0)) {
                return drawCalls;
            }
            let filters = displayObject.$filters;
            let hasBlendMode = (displayObject.$blendMode !== 0);
            let compositeOp: string;
            if (hasBlendMode) {
                compositeOp = blendModes[displayObject.$blendMode];
                if (!compositeOp) {
                    compositeOp = defaultCompositeOp;
                }
            }

            const displayBounds = displayObject.$getOriginalBounds();
            const displayBoundsX = displayBounds.x;
            const displayBoundsY = displayBounds.y;
            const displayBoundsWidth = displayBounds.width;
            const displayBoundsHeight = displayBounds.height;
            if (displayBoundsWidth <= 0 || displayBoundsHeight <= 0) {
                return drawCalls;
            }

            if (!displayObject.mask && filters.length == 1 && (filters[0].type == "colorTransform" || (filters[0].type === "custom" && (<CustomFilter>filters[0]).padding === 0))) {
                let childrenDrawCount = this.getRenderCount(displayObject);
                if (!displayObject.$children || childrenDrawCount == 1) {
                    if (hasBlendMode) {
                        buffer.context.setGlobalCompositeOperation(compositeOp);
                    }

                    buffer.context.$filter = <ColorMatrixFilter>filters[0];
                    if (displayObject.$mask) {
                        drawCalls += this.drawWithClip(displayObject, buffer, offsetX, offsetY);
                    }
                    else if (displayObject.$scrollRect || displayObject.$maskRect) {
                        drawCalls += this.drawWithScrollRect(displayObject, buffer, offsetX, offsetY);
                    }
                    else {
                        drawCalls += this.drawDisplayObject(displayObject, buffer, offsetX, offsetY);
                    }

                    buffer.context.$filter = null;

                    if (hasBlendMode) {
                        buffer.context.setGlobalCompositeOperation(defaultCompositeOp);
                    }

                    return drawCalls;
                }
            }

            // 为显示对象创建一个新的buffer
            let displayBuffer = this.createRenderBuffer(displayBoundsWidth, displayBoundsHeight);
            displayBuffer.context.pushBuffer(displayBuffer);

            //todo 可以优化减少draw次数
            if (displayObject.$mask) {
                drawCalls += this.drawWithClip(displayObject, displayBuffer, -displayBoundsX, -displayBoundsY);
            }
            else if (displayObject.$scrollRect || displayObject.$maskRect) {
                drawCalls += this.drawWithScrollRect(displayObject, displayBuffer, -displayBoundsX, -displayBoundsY);
            }
            else {
                /*
                *****
                */
                this.__setTransform__(displayObject, displayBuffer, -displayBoundsX, -displayBoundsY);
                /*
                *****
                */
                drawCalls += this.drawDisplayObject(displayObject, displayBuffer, -displayBoundsX, -displayBoundsY);
            }

            displayBuffer.context.popBuffer();

            //绘制结果到屏幕
            if (drawCalls > 0) {
                if (hasBlendMode) {
                    buffer.context.setGlobalCompositeOperation(compositeOp);
                }
                drawCalls++;
                // 绘制结果的时候，应用滤镜
                buffer.$offsetX = offsetX + displayBoundsX;
                buffer.$offsetY = offsetY + displayBoundsY;
                let savedMatrix = Matrix.create();
                let curMatrix = buffer.globalMatrix;
                savedMatrix.a = curMatrix.a;
                savedMatrix.b = curMatrix.b;
                savedMatrix.c = curMatrix.c;
                savedMatrix.d = curMatrix.d;
                savedMatrix.tx = curMatrix.tx;
                savedMatrix.ty = curMatrix.ty;
                buffer.useOffset();
                buffer.context.drawTargetWidthFilters(filters, displayBuffer);
                curMatrix.a = savedMatrix.a;
                curMatrix.b = savedMatrix.b;
                curMatrix.c = savedMatrix.c;
                curMatrix.d = savedMatrix.d;
                curMatrix.tx = savedMatrix.tx;
                curMatrix.ty = savedMatrix.ty;
                Matrix.release(savedMatrix);
                if (hasBlendMode) {
                    buffer.context.setGlobalCompositeOperation(defaultCompositeOp);
                }
            }
            renderBufferPool.push(displayBuffer);
            return drawCalls;
        }

        private getRenderCount(displayObject: DisplayObject): number {
            let drawCount = 0;
            const node = displayObject.$getRenderNode();
            if (node) {
                drawCount += node.$getRenderCount();
            }
            if (displayObject.$children) {
                for (const child of displayObject.$children) {
                    const filters = child.$filters;
                    // 特殊处理有滤镜的对象
                    if (filters && filters.length > 0) {
                        return 2;
                    }
                    else if (child.$children) {
                        drawCount += this.getRenderCount(child);
                    }
                    else {
                        const node = child.$getRenderNode();
                        if (node) {
                            drawCount += node.$getRenderCount();
                        }
                    }
                }
            }
            return drawCount;
        }

        /**
         * @private
         */
        private drawWithClip(displayObject: DisplayObject, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number): number {
            let drawCalls = 0;
            let hasBlendMode = (displayObject.$blendMode !== 0);
            let compositeOp: string;
            if (hasBlendMode) {
                compositeOp = blendModes[displayObject.$blendMode];
                if (!compositeOp) {
                    compositeOp = defaultCompositeOp;
                }
            }

            let scrollRect = displayObject.$scrollRect ? displayObject.$scrollRect : displayObject.$maskRect;
            let mask = displayObject.$mask;
            if (mask) {
                let maskRenderMatrix = mask.$getMatrix();
                //遮罩scaleX或scaleY为0，放弃绘制
                if ((maskRenderMatrix.a == 0 && maskRenderMatrix.b == 0) || (maskRenderMatrix.c == 0 && maskRenderMatrix.d == 0)) {
                    return drawCalls;
                }
            }

            //没有遮罩,同时显示对象没有子项
            if (!mask && (!displayObject.$children || displayObject.$children.length == 0)) {
                if (scrollRect) {
                    buffer.context.pushMask(scrollRect.x + offsetX, scrollRect.y + offsetY, scrollRect.width, scrollRect.height);
                }
                //绘制显示对象
                if (hasBlendMode) {
                    buffer.context.setGlobalCompositeOperation(compositeOp);
                }
                drawCalls += this.drawDisplayObject(displayObject, buffer, offsetX, offsetY);
                if (hasBlendMode) {
                    buffer.context.setGlobalCompositeOperation(defaultCompositeOp);
                }
                if (scrollRect) {
                    buffer.context.popMask();
                }
                return drawCalls;
            }
            else {
                let displayBounds = displayObject.$getOriginalBounds();
                const displayBoundsX = displayBounds.x;
                const displayBoundsY = displayBounds.y;
                const displayBoundsWidth = displayBounds.width;
                const displayBoundsHeight = displayBounds.height;
                if (displayBoundsWidth <= 0 || displayBoundsHeight <= 0) {
                    return drawCalls;
                }
                //绘制显示对象自身，若有scrollRect，应用clip
                let displayBuffer = this.createRenderBuffer(displayBoundsWidth, displayBoundsHeight);
                displayBuffer.context.pushBuffer(displayBuffer);
                /*
                *****
                */
                this.__setTransform__(displayObject, displayBuffer, -displayBoundsX, -displayBoundsY);
                /*
                *****
                */
                drawCalls += this.drawDisplayObject(displayObject, displayBuffer, -displayBoundsX, -displayBoundsY);
                //绘制遮罩
                if (mask) {
                    let maskBuffer = this.createRenderBuffer(displayBoundsWidth, displayBoundsHeight);
                    maskBuffer.context.pushBuffer(maskBuffer);
                    let maskMatrix = Matrix.create();
                    maskMatrix.copyFrom(mask.$getConcatenatedMatrix());
                    mask.$getConcatenatedMatrixAt(displayObject, maskMatrix);
                    maskMatrix.translate(-displayBoundsX, -displayBoundsY);
                    maskBuffer.setTransform(maskMatrix.a, maskMatrix.b, maskMatrix.c, maskMatrix.d, maskMatrix.tx, maskMatrix.ty);
                    Matrix.release(maskMatrix);
                    /*
                    *****
                    */
                    this.__setTransform__(mask, maskBuffer, 0, 0);
                    /*
                    *****
                    */
                    drawCalls += this.drawDisplayObject(mask, maskBuffer, 0, 0);
                    maskBuffer.context.popBuffer();
                    displayBuffer.context.setGlobalCompositeOperation("destination-in");
                    displayBuffer.setTransform(1, 0, 0, -1, 0, maskBuffer.height);
                    let maskBufferWidth = maskBuffer.rootRenderTarget.width;
                    let maskBufferHeight = maskBuffer.rootRenderTarget.height;
                    egret.sys.debugRenderNode = null;
                    egret.sys.advancedDrawMode = 'drawWithClip:mask';
                    displayBuffer.context.drawTexture(maskBuffer.rootRenderTarget.texture, 0, 0, maskBufferWidth, maskBufferHeight,
                        0, 0, maskBufferWidth, maskBufferHeight, maskBufferWidth, maskBufferHeight);
                    displayBuffer.setTransform(1, 0, 0, 1, 0, 0);
                    displayBuffer.context.setGlobalCompositeOperation("source-over");
                    maskBuffer.setTransform(1, 0, 0, 1, 0, 0);
                    renderBufferPool.push(maskBuffer);
                }

                displayBuffer.context.setGlobalCompositeOperation(defaultCompositeOp);
                displayBuffer.context.popBuffer();

                //绘制结果到屏幕
                if (drawCalls > 0) {
                    drawCalls++;
                    if (hasBlendMode) {
                        buffer.context.setGlobalCompositeOperation(compositeOp);
                    }
                    if (scrollRect) {
                        buffer.context.pushMask(scrollRect.x + offsetX, scrollRect.y + offsetY, scrollRect.width, scrollRect.height);
                    }
                    let savedMatrix = Matrix.create();
                    let curMatrix = buffer.globalMatrix;
                    savedMatrix.a = curMatrix.a;
                    savedMatrix.b = curMatrix.b;
                    savedMatrix.c = curMatrix.c;
                    savedMatrix.d = curMatrix.d;
                    savedMatrix.tx = curMatrix.tx;
                    savedMatrix.ty = curMatrix.ty;
                    curMatrix.append(1, 0, 0, -1, offsetX + displayBoundsX, offsetY + displayBoundsY + displayBuffer.height);
                    let displayBufferWidth = displayBuffer.rootRenderTarget.width;
                    let displayBufferHeight = displayBuffer.rootRenderTarget.height;
                    buffer.context.drawTexture(displayBuffer.rootRenderTarget.texture, 0, 0, displayBufferWidth, displayBufferHeight,
                        0, 0, displayBufferWidth, displayBufferHeight, displayBufferWidth, displayBufferHeight);
                    if (scrollRect) {
                        displayBuffer.context.popMask();
                    }
                    if (hasBlendMode) {
                        buffer.context.setGlobalCompositeOperation(defaultCompositeOp);
                    }
                    let matrix = buffer.globalMatrix;
                    matrix.a = savedMatrix.a;
                    matrix.b = savedMatrix.b;
                    matrix.c = savedMatrix.c;
                    matrix.d = savedMatrix.d;
                    matrix.tx = savedMatrix.tx;
                    matrix.ty = savedMatrix.ty;
                    Matrix.release(savedMatrix);
                }
                renderBufferPool.push(displayBuffer);
                return drawCalls;
            }
        }

        /**
         * @private
         */
        private drawWithScrollRect(displayObject: DisplayObject, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number): number {
            let drawCalls = 0;
            let scrollRect = displayObject.$scrollRect ? displayObject.$scrollRect : displayObject.$maskRect;
            if (scrollRect.isEmpty()) {
                return drawCalls;
            }
            if (displayObject.$scrollRect) {
                offsetX -= scrollRect.x;
                offsetY -= scrollRect.y;
            }
            let m = buffer.globalMatrix;
            let context = buffer.context;
            let scissor = false;
            if (buffer.$hasScissor || m.b != 0 || m.c != 0) {// 有旋转的情况下不能使用scissor
                buffer.context.pushMask(scrollRect.x + offsetX, scrollRect.y + offsetY, scrollRect.width, scrollRect.height);
            } else {
                let a = m.a;
                let d = m.d;
                let tx = m.tx;
                let ty = m.ty;
                let x = scrollRect.x + offsetX;
                let y = scrollRect.y + offsetY;
                let xMax = x + scrollRect.width;
                let yMax = y + scrollRect.height;
                let minX: number, minY: number, maxX: number, maxY: number;
                //优化，通常情况下不缩放的对象占多数，直接加上偏移量即可。
                if (a == 1.0 && d == 1.0) {
                    minX = x + tx;
                    minY = y + ty;
                    maxX = xMax + tx;
                    maxY = yMax + ty;
                }
                else {
                    let x0 = a * x + tx;
                    let y0 = d * y + ty;
                    let x1 = a * xMax + tx;
                    let y1 = d * y + ty;
                    let x2 = a * xMax + tx;
                    let y2 = d * yMax + ty;
                    let x3 = a * x + tx;
                    let y3 = d * yMax + ty;

                    let tmp = 0;

                    if (x0 > x1) {
                        tmp = x0;
                        x0 = x1;
                        x1 = tmp;
                    }
                    if (x2 > x3) {
                        tmp = x2;
                        x2 = x3;
                        x3 = tmp;
                    }

                    minX = (x0 < x2 ? x0 : x2);
                    maxX = (x1 > x3 ? x1 : x3);

                    if (y0 > y1) {
                        tmp = y0;
                        y0 = y1;
                        y1 = tmp;
                    }
                    if (y2 > y3) {
                        tmp = y2;
                        y2 = y3;
                        y3 = tmp;
                    }

                    minY = (y0 < y2 ? y0 : y2);
                    maxY = (y1 > y3 ? y1 : y3);
                }
                context.enableScissor(minX, -maxY + buffer.height, maxX - minX, maxY - minY);
                scissor = true;
            }
            drawCalls += this.drawDisplayObject(displayObject, buffer, offsetX, offsetY);
            if (scissor) {
                context.disableScissor();
            } else {
                context.popMask();
            }
            return drawCalls;
        }

        /**
         * 将一个RenderNode对象绘制到渲染缓冲
         * @param node 要绘制的节点
         * @param buffer 渲染缓冲
         * @param matrix 要叠加的矩阵
         * @param forHitTest 绘制结果是用于碰撞检测。若为true，当渲染GraphicsNode时，会忽略透明度样式设置，全都绘制为不透明的。
         */
        public drawNodeToBuffer(node: sys.RenderNode, buffer: WebGLRenderBuffer, matrix: Matrix, forHitTest?: boolean): void {
            let webglBuffer: WebGLRenderBuffer = <WebGLRenderBuffer>buffer;

            //pushRenderTARGET
            webglBuffer.context.pushBuffer(webglBuffer);

            webglBuffer.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
            this.renderNode(null, node, buffer, 0, 0, forHitTest);
            webglBuffer.context.$drawWebGL();
            webglBuffer.onRenderFinish();

            //popRenderTARGET
            webglBuffer.context.popBuffer();
        }

        /**
         * 将一个DisplayObject绘制到渲染缓冲，用于RenderTexture绘制
         * @param displayObject 要绘制的显示对象
         * @param buffer 渲染缓冲
         * @param matrix 要叠加的矩阵
         */
        // public drawDisplayToBuffer(displayObject: DisplayObject, buffer: WebGLRenderBuffer, matrix: Matrix): number {
        //     buffer.context.pushBuffer(buffer);
        //     if (matrix) {
        //         buffer.setTransform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);
        //     }
        //     let node: sys.RenderNode;
        //     if (displayObject.$renderDirty) {
        //         node = displayObject.$getRenderNode();
        //     }
        //     else {
        //         node = displayObject.$renderNode;
        //     }
        //     let drawCalls = 0;
        //     if (node) {
        //         drawCalls++;
        //         egret.sys.debugRenderNode = node;
        //         switch (node.type) {
        //             case sys.RenderNodeType.BitmapNode:
        //                 this.renderBitmap(<sys.BitmapNode>node, buffer);
        //                 break;
        //             case sys.RenderNodeType.TextNode:
        //                 this.renderText(<sys.TextNode>node, buffer);
        //                 break;
        //             case sys.RenderNodeType.GraphicsNode:
        //                 this.renderGraphics(<sys.GraphicsNode>node, buffer);
        //                 break;
        //             case sys.RenderNodeType.GroupNode:
        //                 this.renderGroup(displayObject, <sys.GroupNode>node, buffer);
        //                 break;
        //             case sys.RenderNodeType.MeshNode:
        //                 this.renderMesh(<sys.MeshNode>node, buffer);
        //                 break;
        //             case sys.RenderNodeType.NormalBitmapNode:
        //                 this.renderNormalBitmap(<sys.NormalBitmapNode>node, buffer);
        //                 break;
        //         }
        //     }
        //     let children = displayObject.$children;
        //     if (children) {
        //         let length = children.length;
        //         for (let i = 0; i < length; i++) {
        //             let child = children[i];
        //             switch (child.$renderMode) {
        //                 case RenderMode.NONE:
        //                     break;
        //                 case RenderMode.FILTER:
        //                     drawCalls += this.drawWithFilter(child, buffer, 0, 0);
        //                     break;
        //                 case RenderMode.CLIP:
        //                     drawCalls += this.drawWithClip(child, buffer, 0, 0);
        //                     break;
        //                 case RenderMode.SCROLLRECT:
        //                     drawCalls += this.drawWithScrollRect(child, buffer, 0, 0);
        //                     break;
        //                 default:
        //                     /*
        //                     *****
        //                     */
        //                     this.__setTransform__(child, buffer, 0, 0);
        //                     this.__transformDisplayObject__(child, buffer, 0, 0);
        //                     /*
        //                     *****
        //                     */
        //                     drawCalls += this.drawDisplayObject(child, buffer, 0, 0);
        //                     break;
        //             }
        //         }
        //     }

        //     buffer.context.$drawWebGL();
        //     buffer.onRenderFinish();
        //     buffer.context.popBuffer();

        //     return drawCalls;
        // }

        /**
         * @private
         */
        private renderNode(displayObject: DisplayObject, node: sys.RenderNode, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number, forHitTest?: boolean): void {
            buffer.$offsetX = offsetX;
            buffer.$offsetY = offsetY;
            egret.sys.debugRenderNode = node;
            switch (node.type) {
                case sys.RenderNodeType.BitmapNode:
                    this.renderBitmap(<sys.BitmapNode>node, buffer);
                    break;
                case sys.RenderNodeType.TextNode:
                    this.renderText(<sys.TextNode>node, buffer);
                    break;
                case sys.RenderNodeType.GraphicsNode:
                    this.renderGraphics(<sys.GraphicsNode>node, buffer, forHitTest);
                    break;
                case sys.RenderNodeType.GroupNode:
                    this.renderGroup(displayObject, <sys.GroupNode>node, buffer);
                    break;
                case sys.RenderNodeType.MeshNode:
                    this.renderMesh(<sys.MeshNode>node, buffer);
                    break;
                case sys.RenderNodeType.NormalBitmapNode:
                    this.renderNormalBitmap(<sys.NormalBitmapNode>node, buffer);
                    break;
            }
        }

        /**
         * @private
         */
        private renderNormalBitmap(node: sys.NormalBitmapNode, buffer: WebGLRenderBuffer): void {
            let image = node.image;
            if (!image) {
                return;
            }
            buffer.context.drawImage(image, node.sourceX, node.sourceY, node.sourceW, node.sourceH,
                node.drawX, node.drawY, node.drawW, node.drawH, node.imageWidth, node.imageHeight, node.rotated, node.smoothing);
        }

        /**
         * @private
         */
        private renderBitmap(node: sys.BitmapNode, buffer: WebGLRenderBuffer): void {
            let image = node.image;
            if (!image) {
                return;
            }
            //buffer.imageSmoothingEnabled = node.smoothing;
            let data = node.drawData;
            let length = data.length;
            let pos = 0;
            let m = node.matrix;
            let blendMode = node.blendMode;
            let alpha = node.alpha;
            let savedMatrix;
            let offsetX;
            let offsetY;
            if (m) {
                savedMatrix = Matrix.create();
                let curMatrix = buffer.globalMatrix;
                savedMatrix.a = curMatrix.a;
                savedMatrix.b = curMatrix.b;
                savedMatrix.c = curMatrix.c;
                savedMatrix.d = curMatrix.d;
                savedMatrix.tx = curMatrix.tx;
                savedMatrix.ty = curMatrix.ty;
                offsetX = buffer.$offsetX;
                offsetY = buffer.$offsetY;
                buffer.useOffset();
                buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
            }
            //这里不考虑嵌套
            if (blendMode) {
                buffer.context.setGlobalCompositeOperation(blendModes[blendMode]);
            }
            let originAlpha: number;
            if (alpha == alpha) {
                originAlpha = buffer.globalAlpha;
                buffer.globalAlpha *= alpha;
            }
            if (node.filter) {
                buffer.context.$filter = node.filter;
                while (pos < length) {
                    buffer.context.drawImage(image, data[pos++], data[pos++], data[pos++], data[pos++],
                        data[pos++], data[pos++], data[pos++], data[pos++], node.imageWidth, node.imageHeight, node.rotated, node.smoothing);
                }
                buffer.context.$filter = null;
            }
            else {
                while (pos < length) {
                    buffer.context.drawImage(image, data[pos++], data[pos++], data[pos++], data[pos++],
                        data[pos++], data[pos++], data[pos++], data[pos++], node.imageWidth, node.imageHeight, node.rotated, node.smoothing);
                }
            }
            if (blendMode) {
                buffer.context.setGlobalCompositeOperation(defaultCompositeOp);
            }
            if (alpha == alpha) {
                buffer.globalAlpha = originAlpha;
            }
            if (m) {
                let matrix = buffer.globalMatrix;
                matrix.a = savedMatrix.a;
                matrix.b = savedMatrix.b;
                matrix.c = savedMatrix.c;
                matrix.d = savedMatrix.d;
                matrix.tx = savedMatrix.tx;
                matrix.ty = savedMatrix.ty;
                buffer.$offsetX = offsetX;
                buffer.$offsetY = offsetY;
                Matrix.release(savedMatrix);
            }
        }

        /**
         * @private
         */
        private renderMesh(node: sys.MeshNode, buffer: WebGLRenderBuffer): void {
            let image = node.image;
            //buffer.imageSmoothingEnabled = node.smoothing;
            let data = node.drawData;
            let length = data.length;
            let pos = 0;
            let m = node.matrix;
            let blendMode = node.blendMode;
            let alpha = node.alpha;
            let savedMatrix;
            let offsetX;
            let offsetY;
            if (m) {
                savedMatrix = Matrix.create();
                let curMatrix = buffer.globalMatrix;
                savedMatrix.a = curMatrix.a;
                savedMatrix.b = curMatrix.b;
                savedMatrix.c = curMatrix.c;
                savedMatrix.d = curMatrix.d;
                savedMatrix.tx = curMatrix.tx;
                savedMatrix.ty = curMatrix.ty;
                offsetX = buffer.$offsetX;
                offsetY = buffer.$offsetY;
                buffer.useOffset();
                buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
            }
            //这里不考虑嵌套
            if (blendMode) {
                buffer.context.setGlobalCompositeOperation(blendModes[blendMode]);
            }
            let originAlpha: number;
            if (alpha == alpha) {
                originAlpha = buffer.globalAlpha;
                buffer.globalAlpha *= alpha;
            }
            if (node.filter) {
                buffer.context.$filter = node.filter;
                while (pos < length) {
                    buffer.context.drawMesh(image, data[pos++], data[pos++], data[pos++], data[pos++],
                        data[pos++], data[pos++], data[pos++], data[pos++], node.imageWidth, node.imageHeight, node.uvs, node.vertices, node.indices, node.bounds, node.rotated, node.smoothing);
                }
                buffer.context.$filter = null;
            }
            else {
                while (pos < length) {
                    buffer.context.drawMesh(image, data[pos++], data[pos++], data[pos++], data[pos++],
                        data[pos++], data[pos++], data[pos++], data[pos++], node.imageWidth, node.imageHeight, node.uvs, node.vertices, node.indices, node.bounds, node.rotated, node.smoothing);
                }
            }
            if (blendMode) {
                buffer.context.setGlobalCompositeOperation(defaultCompositeOp);
            }
            if (alpha == alpha) {
                buffer.globalAlpha = originAlpha;
            }
            if (m) {
                let matrix = buffer.globalMatrix;
                matrix.a = savedMatrix.a;
                matrix.b = savedMatrix.b;
                matrix.c = savedMatrix.c;
                matrix.d = savedMatrix.d;
                matrix.tx = savedMatrix.tx;
                matrix.ty = savedMatrix.ty;
                buffer.$offsetX = offsetX;
                buffer.$offsetY = offsetY;
                Matrix.release(savedMatrix);
            }
        }

        private canvasRenderer: CanvasRenderer;
        private canvasRenderBuffer: CanvasRenderBuffer;

        /**
         * @private
         */
        private renderText(node: sys.TextNode, buffer: WebGLRenderBuffer): void {
            let width = node.width - node.x;
            let height = node.height - node.y;
            if (width <= 0 || height <= 0 || !width || !height || node.drawData.length == 0) {
                return;
            }
            let canvasScaleX = sys.DisplayList.$canvasScaleX;
            let canvasScaleY = sys.DisplayList.$canvasScaleY;
            let maxTextureSize = buffer.context.$maxTextureSize;
            if (width * canvasScaleX > maxTextureSize) {
                canvasScaleX *= maxTextureSize / (width * canvasScaleX);
            }
            if (height * canvasScaleY > maxTextureSize) {
                canvasScaleY *= maxTextureSize / (height * canvasScaleY);
            }
            width *= canvasScaleX;
            height *= canvasScaleY;
            let x = node.x * canvasScaleX;
            let y = node.y * canvasScaleY;
            if (node.$canvasScaleX != canvasScaleX || node.$canvasScaleY != canvasScaleY) {
                node.$canvasScaleX = canvasScaleX;
                node.$canvasScaleY = canvasScaleY;
                node.dirtyRender = true;
            }
            if (!this.canvasRenderBuffer || !this.canvasRenderBuffer.context) {
                this.canvasRenderer = new CanvasRenderer();
                this.canvasRenderBuffer = new CanvasRenderBuffer(width, height);
            }
            else if (node.dirtyRender) {
                this.canvasRenderBuffer.resize(width, height);
            }

            if (!this.canvasRenderBuffer.context) {
                return;
            }

            if (canvasScaleX != 1 || canvasScaleY != 1) {
                this.canvasRenderBuffer.context.setTransform(canvasScaleX, 0, 0, canvasScaleY, 0, 0);
            }

            if (x || y) {
                if (node.dirtyRender) {
                    this.canvasRenderBuffer.context.setTransform(canvasScaleX, 0, 0, canvasScaleY, -x, -y);
                }
                buffer.transform(1, 0, 0, 1, x / canvasScaleX, y / canvasScaleY);
            }
            else if (canvasScaleX != 1 || canvasScaleY != 1) {
                this.canvasRenderBuffer.context.setTransform(canvasScaleX, 0, 0, canvasScaleY, 0, 0);
            }

            if (node.dirtyRender) {
                let surface = this.canvasRenderBuffer.surface;
                egret.sys.debugRenderNode = node;
                this.canvasRenderer.renderText(node, this.canvasRenderBuffer.context);

                // 拷贝canvas到texture
                let texture = node.$texture;
                if (!texture) {
                    texture = buffer.context.createTexture(<BitmapData><any>surface);
                    node.$texture = texture;
                } else {
                    // 重新拷贝新的图像
                    buffer.context.updateTexture(texture, <BitmapData><any>surface);
                }
                // 保存材质尺寸
                node.$textureWidth = surface.width;
                node.$textureHeight = surface.height;
            }

            let textureWidth = node.$textureWidth;
            let textureHeight = node.$textureHeight;
            buffer.context.drawTexture(node.$texture, 0, 0, textureWidth, textureHeight, 0, 0, textureWidth / canvasScaleX, textureHeight / canvasScaleY, textureWidth, textureHeight);

            if (x || y) {
                if (node.dirtyRender) {
                    this.canvasRenderBuffer.context.setTransform(canvasScaleX, 0, 0, canvasScaleY, 0, 0);
                }
                buffer.transform(1, 0, 0, 1, -x / canvasScaleX, -y / canvasScaleY);
            }
            node.dirtyRender = false;
        }

        /**
         * @private
         */
        private renderGraphics(node: sys.GraphicsNode, buffer: WebGLRenderBuffer, forHitTest?: boolean): void {
            let width = node.width;
            let height = node.height;
            if (width <= 0 || height <= 0 || !width || !height || node.drawData.length == 0) {
                return;
            }
            let canvasScaleX = sys.DisplayList.$canvasScaleX;
            let canvasScaleY = sys.DisplayList.$canvasScaleY;
            if (width * canvasScaleX < 1 || height * canvasScaleY < 1) {
                canvasScaleX = canvasScaleY = 1;
            }
            if (node.$canvasScaleX != canvasScaleX || node.$canvasScaleY != canvasScaleY) {
                node.$canvasScaleX = canvasScaleX;
                node.$canvasScaleY = canvasScaleY;
                node.dirtyRender = true;
            }
            //缩放叠加 width2 / width 填满整个区域
            width = width * canvasScaleX;
            height = height * canvasScaleY;
            var width2 = Math.ceil(width);
            var height2 = Math.ceil(height);
            canvasScaleX *= width2 / width;
            canvasScaleY *= height2 / height;
            width = width2;
            height = height2;
            if (!this.canvasRenderBuffer || !this.canvasRenderBuffer.context) {
                this.canvasRenderer = new CanvasRenderer();
                this.canvasRenderBuffer = new CanvasRenderBuffer(width, height);
            }
            else if (node.dirtyRender || forHitTest) {
                this.canvasRenderBuffer.resize(width, height);
            }
            if (!this.canvasRenderBuffer.context) {
                return;
            }
            if (canvasScaleX != 1 || canvasScaleY != 1) {
                this.canvasRenderBuffer.context.setTransform(canvasScaleX, 0, 0, canvasScaleY, 0, 0);
            }
            if (node.x || node.y) {
                if (node.dirtyRender || forHitTest) {
                    this.canvasRenderBuffer.context.translate(-node.x, -node.y);
                }
                buffer.transform(1, 0, 0, 1, node.x, node.y);
            }
            let surface = this.canvasRenderBuffer.surface;
            if (forHitTest) {
                egret.sys.debugRenderNode = node;
                this.canvasRenderer.renderGraphics(node, this.canvasRenderBuffer.context, true);
                WebGLUtils.deleteWebGLTexture(surface);
                let texture = buffer.context.getWebGLTexture(<BitmapData><any>surface);
                buffer.context.drawTexture(texture, 0, 0, width, height, 0, 0, width, height, surface.width, surface.height);
            } else {
                if (node.dirtyRender) {
                    egret.sys.debugRenderNode = node;
                    this.canvasRenderer.renderGraphics(node, this.canvasRenderBuffer.context);

                    // 拷贝canvas到texture
                    let texture: WebGLTexture = node.$texture;
                    if (!texture) {
                        texture = buffer.context.createTexture(<BitmapData><any>surface);
                        node.$texture = texture;
                    } else {
                        // 重新拷贝新的图像
                        buffer.context.updateTexture(texture, <BitmapData><any>surface);
                    }
                    // 保存材质尺寸
                    node.$textureWidth = surface.width;
                    node.$textureHeight = surface.height;
                }
                let textureWidth = node.$textureWidth;
                let textureHeight = node.$textureHeight;
                buffer.context.drawTexture(node.$texture, 0, 0, textureWidth, textureHeight, 0, 0, textureWidth / canvasScaleX, textureHeight / canvasScaleY, textureWidth, textureHeight);
            }

            if (node.x || node.y) {
                if (node.dirtyRender || forHitTest) {
                    this.canvasRenderBuffer.context.translate(node.x, node.y);
                }
                buffer.transform(1, 0, 0, 1, -node.x, -node.y);
            }
            if (!forHitTest) {
                node.dirtyRender = false;
            }
        }

        private renderGroup(displayObject: DisplayObject, groupNode: sys.GroupNode, buffer: WebGLRenderBuffer): void {
            let m = groupNode.matrix;
            let savedMatrix;
            let offsetX;
            let offsetY;
            if (m) {
                savedMatrix = Matrix.create();
                let curMatrix = buffer.globalMatrix;
                savedMatrix.a = curMatrix.a;
                savedMatrix.b = curMatrix.b;
                savedMatrix.c = curMatrix.c;
                savedMatrix.d = curMatrix.d;
                savedMatrix.tx = curMatrix.tx;
                savedMatrix.ty = curMatrix.ty;
                offsetX = buffer.$offsetX;
                offsetY = buffer.$offsetY;
                buffer.useOffset();
                buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
            }

            let children = groupNode.drawData;
            let length = children.length;
            for (let i = 0; i < length; i++) {
                let node: sys.RenderNode = children[i];
                this.renderNode(displayObject, node, buffer, buffer.$offsetX, buffer.$offsetY);
            }
            if (m) {
                let matrix = buffer.globalMatrix;
                matrix.a = savedMatrix.a;
                matrix.b = savedMatrix.b;
                matrix.c = savedMatrix.c;
                matrix.d = savedMatrix.d;
                matrix.tx = savedMatrix.tx;
                matrix.ty = savedMatrix.ty;
                buffer.$offsetX = offsetX;
                buffer.$offsetY = offsetY;
                Matrix.release(savedMatrix);
            }
        }

        /**
         * @private
         */
        private createRenderBuffer(width: number, height: number): WebGLRenderBuffer {
            let buffer = renderBufferPool.pop();
            if (buffer) {
                buffer.resize(width, height);
            }
            else {
                buffer = new WebGLRenderBuffer(width, height);
                buffer.$computeDrawCall = false;
            }
            return buffer;
        }

        public __setTransform__(displayObject: DisplayObject, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number, isStage?: boolean): void {
            //
            const transform = displayObject.transform;
            $TempMatrix.identity();
            const targetMatrix = buffer ? buffer.globalMatrix : $TempMatrix;
            //
            if (!NumberUtils.matrixEqual(targetMatrix, transform.globalMatrix)
                || offsetX !== transform.offsetX
                || offsetY !== transform.offsetY) {
                transform.onLocalChange();
            }
            //
            if (transform._localID !== transform._currentLocalID) {
                transform._currentLocalID = transform._localID;
                transform._parentID = -1;
            }
            //
            if (transform._parentID !== 0) {
                transform._parentID = 0;
                ++transform._worldID;
            }
            //
            transform.globalMatrix.copyFrom(buffer ? buffer.globalMatrix : $TempMatrix);
            transform.offsetX = offsetX;
            transform.offsetY = offsetY;
            //
            this.__transformDisplayObject__(displayObject/*, buffer, offsetX, offsetY, isStage*/);
        }

        public __transformDisplayObject__(displayObject: DisplayObject/*, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number, isStage?: boolean*/): void {
            let children = displayObject.$children;
            if (children) {
                let length = children.length;
                for (let i = 0; i < length; i++) {
                    let child = children[i];
                    if (!child.visible) {
                        continue;
                    }
                    let offsetX2 = 0;
                    let offsetY2 = 0;

                    const childTransform = child.transform;
                    let m = child.$getMatrix(); //child local
                    //
                    if (childTransform._localID !== childTransform._currentLocalID) {
                        childTransform._currentLocalID = childTransform._localID;
                        childTransform._parentID = -1;
                    }
                    //
                    const parentTransform = displayObject.transform;
                    if (childTransform._parentID !== parentTransform._worldID || this.forceTransform) {
                        /*
                        **************************
                        */
                        childTransform.globalMatrix.copyFrom(parentTransform.globalMatrix);//这一步其实还能优化
                        //if (child.$useTranslate || true) {
                            childTransform.transform(m, parentTransform.offsetX, parentTransform.offsetY);
                            //NumberUtils.__transform__(childTransform.globalMatrix, m.a, m.b, m.c, m.d, parentTransform.offsetX + m.tx, parentTransform.offsetY + m.ty);
                            offsetX2 = -child.$anchorOffsetX;
                            offsetY2 = -child.$anchorOffsetY;
                        //}
                        // else {
                        //     offsetX2 = parentTransform.offsetX + m.tx - child.$anchorOffsetX;
                        //     offsetY2 = parentTransform.offsetY + m.ty - child.$anchorOffsetY;
                        // }
                        ///
                        childTransform.offsetX = offsetX2;
                        childTransform.offsetY = offsetY2;
                        /*
                        **************************
                        */
                        childTransform._parentID = parentTransform._worldID;
                        ++childTransform._worldID;
                    }
                    /* old
                    //先拷贝给孩子，再和孩子的local
                    childTransform.globalMatrix.copyFrom(selfTransform.globalMatrix);
                    if (child.$useTranslate || true) {
                        NumberUtils.__transform__(childTransform.globalMatrix, m.a, m.b, m.c, m.d, selfTransform.offsetX + m.tx, selfTransform.offsetY + m.ty);
                        offsetX2 = -child.$anchorOffsetX;
                        offsetY2 = -child.$anchorOffsetY;
                    }
                    else {
                        offsetX2 = selfTransform.offsetX + m.tx - child.$anchorOffsetX;
                        offsetY2 = selfTransform.offsetY + m.ty - child.$anchorOffsetY;
                    }
                    ///
                    childTransform.offsetX = offsetX2;
                    childTransform.offsetY = offsetY2;
                    */
                    ///
                    switch (child.$renderMode) {
                        case RenderMode.NONE:
                            break;
                        case RenderMode.FILTER:
                            //this.__transformFilter__(child, buffer, offsetX2, offsetY2);
                            break;
                        case RenderMode.CLIP:
                            //drawCalls += this.drawWithClip(child, buffer, offsetX2, offsetY2);
                            break;
                        case RenderMode.SCROLLRECT:
                            //drawCalls += this.drawWithScrollRect(child, buffer, offsetX2, offsetY2);
                            this.__transformScrollRect__(child/*, buffer, offsetX2, offsetY2*/);
                            break;
                        default:
                            this.__transformDisplayObject__(child/*, buffer, offsetX2, offsetY2*/);
                            break;
                    }
                }
            }
        }

        private __transformScrollRect__(displayObject: DisplayObject/*, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number*/): void {
            let scrollRect = displayObject.$scrollRect ? displayObject.$scrollRect : displayObject.$maskRect;
            if (scrollRect.isEmpty()) {
                return;
            }
            const transform = displayObject.transform;
            transform.offsetX -= scrollRect.x;
            transform.offsetY -= scrollRect.y;
            this.__transformDisplayObject__(displayObject/*, buffer, offsetX, offsetY*/);
        }

        /**
         * @private
         */
        private __transformGraphics__(displayObject: DisplayObject, node: sys.GraphicsNode, buffer: WebGLRenderBuffer, forHitTest?: boolean): void {
            if (node.x || node.y) {
                $TempMatrix.setTo(1, 0, 0, 1, node.x, node.y);
                const textureTransform = node.textureTransform;
                textureTransform.globalMatrix.$preMultiplyInto($TempMatrix, textureTransform.globalMatrix);
            }
        }

        /**
         * @private
         */
        private __transformNormalBitmap__(displayObject: DisplayObject, node: sys.NormalBitmapNode, buffer: WebGLRenderBuffer): void {
            const image = node.image;
            if (image && (image["texture"] || (image.source && image.source["texture"]))) {
                //
                const textureTransform = node.textureTransform;
                textureTransform.appendOffsetMatrix();
                // textureTransform.globalMatrix.append(1, 0, 0, 1, textureTransform.offsetX, textureTransform.offsetY);
                // textureTransform.offsetX = 0;
                // textureTransform.offsetY = 0;
                //
                // const sourceX = node.sourceX;
                // const sourceY = node.sourceY;
                // const sourceWidth = node.sourceW;
                // const sourceHeight = node.sourceH;
                // const destX = node.drawX;
                const destY = node.drawY;
                //const destWidth = node.drawW;
                const destHeight = node.drawH;
                //
                $TempMatrix.setTo(1, 0, 0, -1, 0, destHeight + destY * 2);
                textureTransform.transform($TempMatrix, 0, 0);
                //NumberUtils.__transform__(textureTransform.globalMatrix, 1, 0, 0, -1, 0, destHeight + destY * 2);
            }
        }

        /**
         * @private
         */
        private __transformText__(displayObject: DisplayObject, node: sys.TextNode, buffer: WebGLRenderBuffer): void {
            let width = node.width - node.x;
            let height = node.height - node.y;
            if (width <= 0 || height <= 0 || !width || !height || node.drawData.length == 0) {
                return;
            }
            let canvasScaleX = sys.DisplayList.$canvasScaleX;
            let canvasScaleY = sys.DisplayList.$canvasScaleY;
            let maxTextureSize = buffer.context.$maxTextureSize;
            if (width * canvasScaleX > maxTextureSize) {
                canvasScaleX *= maxTextureSize / (width * canvasScaleX);
            }
            if (height * canvasScaleY > maxTextureSize) {
                canvasScaleY *= maxTextureSize / (height * canvasScaleY);
            }
            width *= canvasScaleX;
            height *= canvasScaleY;
            const x = node.x * canvasScaleX;
            const y = node.y * canvasScaleY;
            if (x || y) {
                $TempMatrix.setTo(1, 0, 0, 1, x / canvasScaleX, y / canvasScaleY);
                const textureTransform = node.textureTransform;
                textureTransform.globalMatrix.$preMultiplyInto($TempMatrix, textureTransform.globalMatrix);
            }
        }

        private __transformGroup__(displayObject: DisplayObject, groupNode: sys.GroupNode, buffer: WebGLRenderBuffer): void {
            //const groupNode = groupNode;
            const groupNodeTexTransform = groupNode.textureTransform;
            if (groupNode.matrix) {
                const m = groupNode.matrix;
                //buffer.useOffset();
                groupNodeTexTransform.appendOffsetMatrix();
                // if (groupNodeTexTransform.offsetX !== 0 || groupNodeTexTransform.offsetY !== 0) {
                //     groupNodeTexTransform.globalMatrix.append(1, 0, 0, 1, groupNodeTexTransform.offsetX, groupNodeTexTransform.offsetY);
                //     groupNodeTexTransform.offsetX = 0;
                //     groupNodeTexTransform.offsetY = 0;
                // }
                //buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
                groupNodeTexTransform.transform(m, 0, 0);
                //NumberUtils.__transform__(groupNodeTexTransform.globalMatrix, m.a, m.b, m.c, m.d, m.tx, m.ty);
            }
            const children = groupNode.drawData;
            const length = children.length;
            for (let i = 0; i < length; i++) {
                const node: sys.RenderNode = children[i];
                // node.textureTransform.globalMatrix.copyFrom(textureTransform.globalMatrix);
                // node.textureTransform.offsetX = textureTransform.offsetX;
                // node.textureTransform.offsetY = textureTransform.offsetY;
                this.__calculateVertices__(displayObject, node, buffer, groupNodeTexTransform);
                //this.__transformRenderNode__(displayObject, node, buffer, buffer.$offsetX, buffer.$offsetY);
            }
        }

        /**
         * @private
         */
        private __transformRenderNode__(displayObject: DisplayObject, node: sys.RenderNode, buffer: WebGLRenderBuffer, offsetX: number, offsetY: number, forHitTest?: boolean): void {
            switch (node.type) {
                case sys.RenderNodeType.BitmapNode:
                    this.__transformBitmap__(displayObject, <sys.BitmapNode>node, buffer);
                    break;
                case sys.RenderNodeType.TextNode:
                    this.__transformText__(displayObject, <sys.TextNode>node, buffer);
                    break;
                case sys.RenderNodeType.GraphicsNode:
                    this.__transformGraphics__(displayObject, <sys.GraphicsNode>node, buffer, forHitTest);
                    break;
                case sys.RenderNodeType.GroupNode:
                    this.__transformGroup__(displayObject, <sys.GroupNode>node, buffer);
                    break;
                case sys.RenderNodeType.MeshNode:
                    this.__transformMesh__(displayObject, <sys.MeshNode>node, buffer);
                    break;
                case sys.RenderNodeType.NormalBitmapNode:
                    this.__transformNormalBitmap__(displayObject, <sys.NormalBitmapNode>node, buffer);
                    break;
                default: {
                    console.error('undefined node.type = ' + node.type);
                    break;
                }
            }
        }

        /**
         * @private
         */
        private __transformMesh__(displayObject: DisplayObject, node: sys.MeshNode, buffer: WebGLRenderBuffer): void {
            const textureTransform = node.textureTransform;
            if (node.matrix) {
                const m = node.matrix;
                //buffer.useOffset();
                textureTransform.appendOffsetMatrix();
                // if (textureTransform.offsetX !== 0 || textureTransform.offsetY !== 0) {
                //     textureTransform.globalMatrix.append(1, 0, 0, 1, textureTransform.offsetX, textureTransform.offsetY);
                //     textureTransform.offsetX = 0;
                //     textureTransform.offsetY = 0;
                // }
                //buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
                textureTransform.transform(m, 0, 0);
                //NumberUtils.__transform__(textureTransform.globalMatrix, m.a, m.b, m.c, m.d, m.tx, m.ty);
            }
        }

        /**
         * @private
         */
        private __transformBitmap__(displayObject: DisplayObject, node: sys.BitmapNode, buffer: WebGLRenderBuffer): void {
            //
            const textureTransform = node.textureTransform;
            if (node.matrix) {
                const m = node.matrix;
                //buffer.useOffset();
                textureTransform.appendOffsetMatrix();
                // if (textureTransform.offsetX !== 0 || textureTransform.offsetY !== 0) {
                //     textureTransform.globalMatrix.append(1, 0, 0, 1, textureTransform.offsetX, textureTransform.offsetY);
                //     textureTransform.offsetX = 0;
                //     textureTransform.offsetY = 0;
                // }
                //buffer.transform(m.a, m.b, m.c, m.d, m.tx, m.ty);
                textureTransform.transform(m, 0, 0);
                //NumberUtils.__transform__(textureTransform.globalMatrix, m.a, m.b, m.c, m.d, m.tx, m.ty);
            }
            ///
            const image = node.image;
            if (image) {
                if (image["texture"] || (image.source && image.source["texture"])) {
                    //
                    textureTransform.appendOffsetMatrix();
                    // textureTransform.globalMatrix.append(1, 0, 0, 1, textureTransform.offsetX, textureTransform.offsetY);
                    // textureTransform.offsetX = 0;
                    // textureTransform.offsetY = 0;
                    //
                    let data = node.drawData;
                    let length = data.length;
                    let pos = 0;
                    while (pos < length) {
                        const sourceX = data[pos++];
                        const sourceY = data[pos++];
                        const sourceWidth = data[pos++];
                        const sourceHeight = data[pos++];
                        const destX = data[pos++];
                        const destY = data[pos++];
                        const destWidth = data[pos++];
                        const destHeight = data[pos++];
                        egret.$TempMatrix.setTo(1, 0, 0, -1, 0, destHeight + destY * 2);
                        textureTransform.globalMatrix.$preMultiplyInto(egret.$TempMatrix, textureTransform.globalMatrix);
                        egret.$TempMatrix.identity();
                    }
                }
            }
        }

        private readonly forceTransform: boolean = false;


        private __calculateVertices__(displayObject: DisplayObject, node: sys.RenderNode, buffer: WebGLRenderBuffer, textureTransform: Transform): void {
            if (!displayObject || !node) {
                return;
            }
            if ( (node._transformID === displayObject.transform._worldID && node._currentTextureID === node._textureID)) {
                if (node.type === sys.RenderNodeType.GroupNode) {
                    (<sys.GraphicsNode>node).onTextureChange();//sys.RenderNodeType.GroupNode 要强刷是因为龙骨的版本的问题。
                }
                else {
                    return;//无任何变化
                }
            }
            //关掉变量
            node._transformID = displayObject.transform._worldID;
            node._currentTextureID = node._textureID;
            //赋值
            const nodeTexTransform = node.textureTransform;
            nodeTexTransform.globalMatrix.copyFrom(textureTransform.globalMatrix);
            nodeTexTransform.offsetX = textureTransform.offsetX;
            nodeTexTransform.offsetY = textureTransform.offsetY;
            //texture空间转换  
            this.__transformRenderNode__(displayObject, node, buffer, 0, 0);
        }
    }
}
