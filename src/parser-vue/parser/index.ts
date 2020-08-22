import { TokenType, Scanner } from '../tokenizer';
import { errorText } from './constant';

import * as utils from './utils';

import path from 'path-browserify';

import {
    Node,
    Root,
    NodeType,
    Location,
    Range,
    Comment,
    Element,
    Attribute,
    Command,
    ContentMustache,
    ParserError,
    ParserOptions,
    TextNode,
} from './types';

export * from './types';

class Parser {
    readonly code: string;
    readonly scanner: Scanner;
    readonly options: ParserOptions;
    readonly errors: ParserError[] = [];
    readonly warnings: ParserError[] = [];

    readonly root: Root;

    readonly rangeAt: (start: number, end: number) => Range;
    readonly positionAt: (offset: number) => Location;

    /** 当前节点 */
    private curNode: Node;
    /** 当前标志符 */
    private token: TokenType;
    /** 当前标签 */
    private endTagName = '';
    /** 当前结束标签起点 */
    private endTagStart = utils.nullLoc;

    constructor(code: string, opt: ParserOptions = {}) {
        this.code = code;
        this.scanner = new Scanner(code);
        this.options = {
            location: opt.location || true,
            errorDetail: opt.errorDetail || false,
            original: opt.original || '',
            filePath: opt.filePath || '',
        };

        const { rangeAt, positionAt } = utils.findLocation(code, opt.location);
        const inputPath = this.options.filePath || '';

        this.options.filePath = path.isAbsolute(inputPath)
            ? inputPath
            : path.join(this.options.original || '', inputPath);

        this.rangeAt = rangeAt;
        this.positionAt = positionAt;

        this.root = {
            type: NodeType.Root,
            range: rangeAt(0, code.length),
        };

        this.curNode = this.root;
        this.token = this.scanner.scan();
    }

    private closeRoot() {
        // 当前节点不是根节点，则说明其中有节点没有正常关闭，抛出错误
        if (this.curNode !== this.root) {
            const len = this.code.length;
            const endPosition = this.positionAt(len);

            this.errors.push({
                message: errorText.unexpectedCharacter('EOF'),
                range: this.rangeAt(len - 2, len - 1),
            });

            // 向上关闭未关闭的节点
            while (this.curNode !== undefined && this.curNode !== this.root) {
                if (this.curNode.range.end.offset === -1) {
                    this.curNode.range.end = endPosition;
                }

                if ('startTagEnd' in this.curNode && this.curNode.startTagEnd.offset === -1) {
                    this.curNode.startTagEnd = endPosition;
                }

                if ('endTagStart' in this.curNode && this.curNode.endTagStart.offset === -1) {
                    this.curNode.endTagStart = endPosition;
                }

                this.curNode = this.curNode.parent as Node;
            }
        }
    }

    private closeNode() {
        if (this.endTagName) {
            let node = this.curNode as Element;

            // 向上匹配相同标签节点
            while (this.endTagName !== node.tag && node.parent) {
                node = node.parent as Element;
            }

            // 非根节点
            if (node.parent) {
                /**
                 * 未匹配节点均为“未闭合节点”
                 * 结束点为当前闭合标签的开始
                 */
                while (this.curNode !== node) {
                    this.curNode.range.end = this.endTagStart;

                    if (this.curNode.type === NodeType.Element) {
                        if (this.curNode.startTagEnd.offset === -1) {
                            this.curNode.startTagEnd = this.curNode.range.end;
                        }

                        this.errors.push({
                            message: errorText.tagUnClosed,
                            range: {
                                start: this.curNode.range.start,
                                end: this.curNode.startTagEnd,
                            },
                        });
                    }

                    // 校验
                    this.checkElement(this.curNode);
                    this.curNode = this.curNode.parent! as Element;
                }

                // 当前节点闭合
                this.curNode.endTagStart = this.endTagStart;
                this.curNode.range.end = this.positionAt(this.scanner.tokenEnd);

                // 校验
                this.checkElement(this.curNode);

                // 当前节点出栈
                this.curNode = this.curNode.parent!;
            }
            // 已经是根节点，说明此闭标签是多余的
            else {
                this.errors.push({
                    message: errorText.extraCloseTag,
                    range: {
                        start: this.endTagStart,
                        end: this.positionAt(this.scanner.tokenEnd),
                    },
                });
            }
        }
    }

    // TODO:
    private  addAttr() {
        if (this.curNode.type === NodeType.Attribute) {
            this.curNode = this.curNode.parent as Element;
        }

        const node = this.curNode as Element;
        const text = this.scanner.tokenText;

        const attr: Attribute | Command = {
            type: NodeType.Attribute,
            parent: node,
            name: this.scanner.tokenText,
            range: this.rangeAt(this.scanner.tokenStart, this.scanner.tokenEnd),
            nameEnd: this.positionAt(this.scanner.tokenEnd),
            valueStart: utils.nullLoc,
        };

        // 绑定值
        if (attr.name[0] === ':') {
            attr.name = `v-bind${attr.name}`;
        }
        // 事件
        else if (attr.name[0] === '@') {
            attr.name = `v-on:${attr.name.slice(1)}`;
        }

        // 指令
        if (attr.name.indexOf('v-') === 0) {
            if (!node.commands) {
                node.commands = [];
            }

            if (node.commands.find(({ name }) => name === attr.name)) {
                this.warnings.push({
                    message: errorText.attributeDuplicate,
                    range: attr.range,
                });
            }

            const [commandName, bind] = attr.name.split(':');
            const command: Command = {
                ...attr,
                type: NodeType.Command,
            }
        }
        // 属性
        else {
            if (!node.attrs) {
                node.attrs = [];
            }

            if (node.attrs.find(({ name }) => name === attr.name)) {
                this.warnings.push({
                    message: errorText.attributeDuplicate,
                    range: attr.range,
                });
            }

            node.attrs.push(attr);

            // TODO: 这里是否需要验证 style
        }

        this.curNode = attr;
    }

    private checkElement(node = this.curNode) {
        if (node.type !== NodeType.Element) {
            return;
        }

        if (node.tag === 'template') {
            this.checkTemplate(node);
        }

        this.checkFor(node);
    }

    private checkTemplate(node: Element) {
        // ..
    }

    private checkFor(node: Element) {

    }

    parse() {
        while (this.token !== TokenType.EOS) {
            switch (this.token) {
                case TokenType.StartCommentTag: {
                    const comment: Comment = {
                        type: NodeType.Comment,
                        text: '',
                        parent: this.curNode,
                        range: {
                            start: this.positionAt(this.scanner.tokenStart),
                            end: utils.nullLoc,
                        },
                    };

                    if (!this.curNode.children) {
                        this.curNode.children = [];
                    }

                    this.curNode.children.push(comment);
                    this.curNode = comment;
                    break;
                }
                case TokenType.EndCommentTag: {
                    const node = this.curNode as Comment;

                    node.range.end = this.positionAt(this.scanner.tokenEnd);
                    this.curNode = node.parent as Node;
                    break;
                }
                case TokenType.Comment: {
                    (this.curNode as Comment).text = this.scanner.tokenText;
                    break;
                }
                case TokenType.Content: {
                    const start = this.scanner.tokenStart;
                    const end = this.scanner.tokenEnd;

                    if (!this.curNode.children) {
                        this.curNode.children = [];
                    }

                    const node: TextNode = {
                        type: NodeType.ContentText,
                        text: this.code.substring(start, end),
                        range: this.rangeAt(start, end),
                        parent: this.curNode,
                    };

                    this.curNode.children.push(node);

                    break;
                }
                case TokenType.StartTagOpen: {
                    const node: Element = {
                        type: NodeType.Element,
                        range: {
                            start: this.positionAt(this.scanner.tokenStart),
                            end: utils.nullLoc,
                        },
                        parent: this.curNode,
                        startTagEnd: utils.nullLoc,
                        endTagStart: utils.nullLoc,
                        tag: '',
                    };

                    if (!this.curNode.children) {
                        this.curNode.children = [];
                    }

                    this.curNode.children.push(node);
                    this.curNode = node;
                    break;
                }
                case TokenType.StartTagClose: {
                    let node = this.curNode as Element | Attribute;

                    if (node.type === NodeType.Attribute) {
                        node = node.parent!;
                    }

                    node.startTagEnd = this.positionAt(this.scanner.tokenEnd);

                    this.curNode = node;
                    break;
                }
                case TokenType.StartTagSelfClose: {
                    if (this.curNode.type === NodeType.Attribute) {
                        this.curNode = this.curNode.parent as Node;
                    }

                    const node = this.curNode as Element;
                    const endPosition = this.positionAt(this.scanner.tokenEnd);

                    node.selfClose = true;
                    node.range.end = endPosition;
                    node.startTagEnd = endPosition;

                    this.checkElement(node);
                    this.curNode = node.parent as Node;

                    break;
                }
                case TokenType.StartTag: {
                    (this.curNode as Element).tag = this.scanner.tokenText.toLowerCase();
                    break;
                }
                case TokenType.EndTagOpen: {
                    this.endTagName = '';
                    this.endTagStart = this.positionAt(this.scanner.tokenStart);
                    break;
                }
                case TokenType.EndTagClose: {
                    this.closeNode();
                    break;
                }
                case TokenType.EndTag: {
                    this.endTagName = this.scanner.tokenText.toLowerCase();
                    break;
                }
                case TokenType.AttributeName: {
                    this.addAttr();
                    break;
                }
                case TokenType.AttributeValue: {
                    const attr = this.curNode as Attribute;

                    attr.value = this.scanner.tokenText;
                    attr.valueStart = this.positionAt(this.scanner.tokenStart);
                    attr.range.end = this.positionAt(this.scanner.tokenEnd);

                    break;
                }
                case TokenType.AttributeMark: {
                    (this.curNode as Attribute).range.end = this.positionAt(this.scanner.tokenEnd);
                    break;
                }
                case TokenType.ContentMustacheStart: {
                    const attr = this.curNode as Attribute;

                    if (!attr.children) {
                        attr.children = [];
                    }

                    const mustache: ContentMustache = {
                        type: NodeType.ContentMustache,
                        text: '',
                        parent: attr,
                        range: {
                            start: this.positionAt(this.scanner.tokenStart),
                            end: utils.nullLoc,
                        },
                    };

                    attr.children.push(mustache);
                    this.curNode = mustache;

                    break;
                }
                case TokenType.ContentMustacheEnd: {
                    const parent = this.curNode.parent as Node;
                    const endPosition = this.positionAt(this.scanner.tokenEnd);

                    if (parent.type === NodeType.Element && parent.tag === 'view') {
                        this.warnings.push({
                            message: errorText.viewEleCannotContainMustache,
                            range: {
                                start: { ...this.curNode.range.start },
                                end: { ...endPosition },
                            },
                        });
                    }

                    this.curNode.range.end = endPosition;
                    this.curNode = parent;
                    break;
                }
                case TokenType.ContentMustache: {
                    (this.curNode as ContentMustache).text = this.scanner.tokenText;
                    break;
                }
                case TokenType.Script: {
                    // TODO:
                    break;
                }
                case TokenType.Style: {
                    // TODO:
                    break;
                }
                case TokenType.Whitespace: {
                    break;
                }
                case TokenType.Unknown: {
                    this.errors.push({
                        message: this.scanner.tokenError || '',
                        range: this.rangeAt(this.scanner.tokenStart, this.scanner.tokenEnd),
                    });

                    break;
                }
            }

            if (this.scanner.tokenError && this.scanner.tokenType !== TokenType.Unknown) {
                this.errors.push({
                    message: this.scanner.tokenError,
                    range: this.rangeAt(this.scanner.tokenStart, this.scanner.tokenEnd),
                });
            }

            this.token = this.scanner.scan();
        }

        this.closeRoot();
    }
}

export function parse(code: string, opt?: ParserOptions) {
    const parser = new Parser(code, opt);

    parser.parse();

    return {
        root: parser.root,
        errors: parser.errors,
        warnings: parser.warnings,
    };
}