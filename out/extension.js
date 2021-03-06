'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const vscode_1 = require("vscode");
let uri = vscode_1.Uri.parse('glsl-preview://authority/glsl-preview');
let provider;
let diagnosticCollection;
let ti;
function activate(context) {
    provider = new GlslDocumentContentProvider(context);
    diagnosticCollection = vscode.languages.createDiagnosticCollection('glslCanvas');
    //
    vscode.workspace.onDidChangeTextDocument(onDidChangeTextDocument);
    vscode.workspace.onDidCloseTextDocument(onDidCloseTextDocument);
    vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration);
    vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor);
    // vscode.window.onDidChangeTextEditorViewColumn(onDidChangeTextEditorViewColumn);
    // vscode.workspace.onDidOpenTextDocument(onDidOpenTextDocument);
    vscode.commands.registerCommand('glsl-canvas.createShader', onCreateShader);
    vscode.commands.registerCommand('glsl-canvas.revealGlslLine', onRevealLine);
    vscode.commands.registerCommand('glsl-canvas.showDiagnostic', onShowDiagnostic);
    let command = vscode.commands.registerCommand('glsl-canvas.showGlslCanvas', () => {
        return vscode.commands.executeCommand('vscode.previewHtml', uri, vscode_1.ViewColumn.Two, 'glslCanvas').then((success) => {
            // success
        }, (reason) => {
            vscode.window.showErrorMessage(reason);
        });
    });
    let content = vscode.workspace.registerTextDocumentContentProvider('glsl-preview', provider);
    context.subscriptions.push(command, content);
    context.subscriptions.push(diagnosticCollection);
}
exports.activate = activate;
function currentGlslEditor() {
    const editor = vscode.window.activeTextEditor;
    return editor && (editor.document.languageId === 'glsl') ? editor : null; // || editor.document.languageId === 'plaintext'
}
function currentGlslDocument() {
    const editor = currentGlslEditor();
    return editor ? editor.document : null;
}
function onDidChangeTextDocument(e) {
    // console.log('onDidChangeTextDocument', e.document.uri.path);
    clearTimeout(ti);
    diagnosticCollection.clear();
    ti = setTimeout(function () {
        provider.update(uri);
    }, 1000);
}
function onDidCloseTextDocument(document) {
    if (document.languageId === 'glsl') {
        provider.update(uri);
    }
}
function onDidChangeActiveTextEditor(editor) {
    // console.log('onDidChangeActiveTextEditor', editor.document.uri);
    if (currentGlslEditor()) {
        provider.update(uri);
    }
}
function onDidChangeConfiguration(e) {
    if (currentGlslEditor()) {
        provider.update(uri);
    }
}
/*
function onDidChangeTextEditorViewColumn(e: vscode.TextEditorViewColumnChangeEvent) {
    console.log('onDidChangeTextEditorViewColumn', e.viewColumn.toString());
}

function onDidOpenTextDocument(document: vscode.TextDocument) {
    console.log('onDidOpenTextDocument', document.uri.path);
}
*/
function onCreateShader(uri) {
    /*
    if (!vscode.workspace.rootPath) {
        return vscode.window.showErrorMessage('No project currently open!');
    }
    */
    const folder = vscode.workspace.rootPath || '';
    // console.log('onCreateShader', folder);
    let newFile = vscode.Uri.parse('untitled:' + path.join(folder, 'untitled.glsl'));
    let i = 1;
    if (fs.existsSync(newFile.fsPath)) {
        newFile = vscode.Uri.parse('untitled:' + path.join(folder, 'untitled' + i + '.glsl'));
        i++;
    }
    vscode.workspace.openTextDocument(newFile).then(document => {
        // console.log('document', document);
        const edit = new vscode.WorkspaceEdit();
        edit.insert(newFile, new vscode.Position(0, 0), `
#ifdef GL_ES
    precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define PI_TWO			1.570796326794897
#define PI				3.141592653589793
#define TWO_PI			6.283185307179586

vec2 coord(in vec2 p) {
    p = p / u_resolution.xy;
    // correct aspect ratio
    if (u_resolution.x > u_resolution.y) {
        p.x *= u_resolution.x / u_resolution.y;
        p.x += (u_resolution.y - u_resolution.x) / u_resolution.y / 2.0;
    } else {
        p.y *= u_resolution.y / u_resolution.x;
        p.y += (u_resolution.x - u_resolution.y) / u_resolution.x / 2.0;
    }
    // centering
    p -= 0.5;
    p *= vec2(-1.0, 1.0);
    return p;
}
#define rx 1.0 / min(u_resolution.x, u_resolution.y)
#define uv gl_FragCoord.xy / u_resolution.xy
#define st coord(gl_FragCoord.xy)
#define mx coord(u_mouse)

void main() {
    vec3 color = vec3(
        abs(cos(st.x + mx.x)), 
        abs(sin(st.y + mx.y)), 
        abs(sin(u_time))
    );
    gl_FragColor = vec4(color, 1.0);
}
`);
        return vscode.workspace.applyEdit(edit).then(success => {
            if (success) {
                vscode.window.showTextDocument(document, vscode_1.ViewColumn.Two);
            }
            else {
                vscode.window.showInformationMessage('Error!');
            }
        });
    });
}
function onRevealLine(uri, line, message) {
    // console.log('glsl-canvas.revealGlslLine', line, uri.toString());
    for (let editor of vscode.window.visibleTextEditors) {
        // console.log('editor', editor.document.uri.toString());
        if (editor.document.uri.toString() === uri.toString()) {
            let range = editor.document.lineAt(line - 1).range;
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
            onDiagnostic(editor, line, message);
        }
    }
}
function onShowDiagnostic(uri, line, message) {
    for (let editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.toString() === uri.toString()) {
            onDiagnostic(editor, line, message);
        }
    }
}
function onDiagnostic(editor, line, message = 'error') {
    let diagnosticMap = new Map();
    let file = vscode.Uri.file(editor.document.fileName).toString();
    let range = editor.document.lineAt(line - 1).range;
    let diagnostics = diagnosticMap.get(file);
    if (!diagnostics) {
        diagnostics = [];
    }
    let diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    diagnostics.push(diagnostic);
    diagnosticMap.set(file, diagnostics);
    diagnosticMap.forEach((value, key) => {
        diagnosticCollection.set(vscode.Uri.parse(key), value);
    });
}
function deactivate() {
    diagnosticCollection.clear();
    provider = null;
}
exports.deactivate = deactivate;
class DocumentOptions {
    constructor() {
        const document = currentGlslDocument();
        const config = vscode.workspace.getConfiguration('glsl-canvas');
        this.uri = document ? document.uri : null;
        this.fragment = document ? document.getText() : '';
        this.vertex = '';
        this.uniforms = config['uniforms'] || {};
        this.textures = config['textures'] || {};
    }
    serialize() {
        return JSON.stringify(this);
    }
}
class GlslDocumentContentProvider {
    constructor(context) {
        this.onChange = new vscode_1.EventEmitter();
        this.context = context;
    }
    provideTextDocumentContent(uri) {
        // console.log('provideTextDocumentContent');
        const config = vscode.workspace.getConfiguration('editor');
        // console.log('config', config);
        let options = new DocumentOptions();
        const content = `        
            <head>
                <link href="file://${this.getResource('fonts/styles.css')}" rel="stylesheet">
                <!-- <link href="file://${this.getResource('css/vendors.min.css')}" rel="stylesheet"> -->
                <style>
                    html, body { font-family: ${config.fontFamily}; font-weight: ${config.fontWeight}; font-size: ${config.fontSize}; };
                </style>
                <script src="file://${this.getResource('js/vendors.min.js')}"></script>         
                <link href="file://${this.getResource('css/app.min.css')}" rel="stylesheet"/>          
            </head>
            <script>
                var options = ${options.serialize()};
            </script>
            <body class="idle">
                <div class="content">
                    <canvas class="shader"></canvas>
                </div>
                <div class="tools">
                    <button class="btn btn-pause" unselectable><i class="icon-pause"></i></button>
                    <button class="btn btn-record" unselectable><i class="icon-record"></i></button>
                    <button class="btn btn-stats" unselectable><i class="icon-stats"></i></button>
                </div>
                <div class="errors"></div>
                <div class="welcome"><div class="welcome-content" unselectable><p>There's no active .glsl editor</p><button class="btn-create"><span>create one</span></button></div></div>
                <script src="file://${this.getResource('js/app.min.js')}"></script>
            </body>
        `;
        // console.log('provideTextDocumentContent', content);
        return content;
    }
    update(uri) {
        let options = new DocumentOptions();
        vscode.commands.executeCommand('_workbench.htmlPreview.postMessage', uri, options.serialize()).then((success) => {
            // console.log('GlslDocumentContentProvider.update.success');
        }, (reason) => {
            // console.log('GlslDocumentContentProvider.update.error');
            vscode.window.showErrorMessage(reason);
        });
        // this.onChange.fire(uri);
    }
    getResource(resource) {
        return this.context.asAbsolutePath(path.join('resources', resource));
    }
    get onDidChange() {
        return this.onChange.event;
    }
}
//# sourceMappingURL=extension.js.map