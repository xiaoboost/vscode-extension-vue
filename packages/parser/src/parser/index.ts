import { TokenKind, Scanner } from '../tokenizer';
import { errorText } from './constant';
import { clone } from '@xvue/utils/object';

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
    Script,
    Style,
} from './types';

export * from './types';

class Parser {
    readonly code: string;
    readonly scanner: Scanner;
    readonly options: Required<ParserOptions>;
    readonly errors: ParserError[] = [];
    readonly warnings: ParserError[] = [];

    readonly root: Root;

    readonly rangeAt: (start: number, end: number) => Range;
    readonly positionAt: (offset: number) => Location;

    /** 当前节点 */
    private curNode: Node;
    /** 当前标志符 */
    private token: TokenKind;
    /** 当前标签 */
    private endTagName = '';
    /** 当前结束标签起点 */
    private endTagStart = utils.nullLoc;

    constructor(code: string, opt: ParserOptions = {}) {
        this.code = code;
        this.scanner = new Scanner(code);
        this.options = {
            workspace: opt.workspace ?? '/',
            filePath: opt.filePath ?? './index.vue',
            version: opt.version ?? '3.0',
            location: opt.location ?? true,
            errorDetail: opt.errorDetail ?? false,
        };

        const { filePath, location, workspace } = this.options;
        const { rangeAt, positionAt } = utils.findLocation(code, location);

        this.options.filePath = path.isAbsolute(filePath) ? filePath : path.join(workspace, filePath);

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

    private checkElement(node = this.curNode) {
        if (node.type !== NodeType.Element) {
            return;
        }

        // TODO: for 等模板语法
    }

    parse() {
        const { scanner } = this;

        while (this.token !== TokenKind.EOS) {
            switch (this.token) {
                case TokenKind.StartCommentTag: {
                    const comment: Comment = {
                        type: NodeType.Comment,
                        text: '',
                        parent: this.curNode,
                        range: {
                            start: this.positionAt(scanner.tokenStart),
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
                case TokenKind.EndCommentTag: {
                    const node = this.curNode as Comment;

                    node.range.end = this.positionAt(scanner.tokenEnd);
                    this.curNode = node.parent as Node;
                    break;
                }
                case TokenKind.Comment: {
                    (this.curNode as Comment).text = scanner.tokenText;
                    break;
                }
                case TokenKind.Content: {
                    const start = scanner.tokenStart;
                    const end = scanner.tokenEnd;

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
                case TokenKind.StartTagOpen: {
                    const node: Element = {
                        type: NodeType.Element,
                        range: {
                            start: this.positionAt(scanner.tokenStart),
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
                case TokenKind.StartTagClose: {
                    let node = this.curNode as Element | Attribute;

                    if (node.type === NodeType.Attribute) {
                        node = node.parent!;
                    }

                    node.startTagEnd = this.positionAt(scanner.tokenEnd);

                    this.curNode = node;
                    break;
                }
                case TokenKind.StartTagSelfClose: {
                    if (this.curNode.type === NodeType.Attribute) {
                        this.curNode = this.curNode.parent as Node;
                    }

                    const node = this.curNode as Element;
                    const endPosition = this.positionAt(scanner.tokenEnd);

                    node.selfClose = true;
                    node.range.end = endPosition;
                    node.startTagEnd = endPosition;

                    this.checkElement(node);
                    this.curNode = node.parent as Node;

                    break;
                }
                case TokenKind.StartTag: {
                    (this.curNode as Element).tag = scanner.tokenText.toLowerCase();
                    break;
                }
                case TokenKind.EndTagOpen: {
                    this.endTagName = '';
                    this.endTagStart = this.positionAt(scanner.tokenStart);
                    break;
                }
                case TokenKind.EndTagClose: {
                    this.closeNode();
                    break;
                }
                case TokenKind.EndTag: {
                    this.endTagName = scanner.tokenText.toLowerCase();
                    break;
                }
                case TokenKind.AttributeName: {
                    if (this.curNode.type === NodeType.Attribute) {
                        this.curNode = this.curNode.parent as Element;
                    }
            
                    const node = this.curNode as Element;
            
                    if (!node.attrs) {
                        node.attrs = [];
                    }

                    const range = this.rangeAt(scanner.tokenStart, scanner.tokenEnd);
                    const attr: Attribute = {
                        type: NodeType.Attribute,
                        parent: node,
                        range,
                        value: {
                            value: true,
                        },
                        name: {
                            value: scanner.tokenText,
                            range: clone(range),
                        },
                    };
        
                    if (node.attrs.find(({ name }) => name === attr.name)) {
                        this.warnings.push({
                            message: errorText.attributeDuplicate,
                            range: attr.range,
                        });
                    }
        
                    node.attrs.push(attr);
        
                    this.curNode = attr;
                    break;
                }
                case TokenKind.AttributeValue: {
                    const attr = this.curNode as Attribute;

                    attr.range.end = this.positionAt(scanner.tokenEnd);
                    attr.value.value = scanner.tokenText;
                    attr.value.range = {
                        start: this.positionAt(scanner.tokenStart),
                        end: { ...attr.range.end },
                    };

                    // TODO:
                    if (attr.name.value === 'style') {

                    }

                    break;
                }
                case TokenKind.AttributeMark: {
                    (this.curNode as Attribute).range.end = this.positionAt(scanner.tokenEnd);
                    break;
                }
                case TokenKind.AttributeDelimiter: {
                    const attr = this.curNode as Attribute | Command;

                    // 有等号，默认值改为空字符串
                    attr.value.value = '';
                    attr.range.end = this.positionAt(scanner.tokenEnd);

                    break;
                }
                case TokenKind.CommandName:
                case TokenKind.CommandShortName: {
                    if (this.curNode.type === NodeType.Attribute) {
                        this.curNode = this.curNode.parent as Element;
                    }
            
                    const node = this.curNode as Element;
            
                    if (!node.commands) {
                        node.commands = [];
                    }

                    let commandName = scanner.tokenText;
                    let isShortName = false;

                    if (this.token === TokenKind.CommandShortName) {
                        isShortName = true;
                        if (commandName === '@') {
                            commandName = 'on';
                        }
                        else if (commandName === ':') {
                            commandName = 'bind';
                        }
                    }
                    else {
                        isShortName = false;
                        commandName = commandName.slice(2);
                    }
        
                    const range = this.rangeAt(scanner.tokenStart, scanner.tokenEnd);
                    const command: Command = {
                        type: NodeType.Command,
                        parent: node,
                        isShortName,
                        range,
                        name: {
                            value: commandName,
                            range: clone(range),
                        },
                        value: {
                            value: '',
                        },
                    };
        
                    if (node.commands.find(({ name }) => name.value === commandName)) {
                        this.warnings.push({
                            message: errorText.attributeDuplicate,
                            range: command.range,
                        });
                    }
        
                    node.commands.push(command);
        
                    this.curNode = command;
                    break;
                }
                case TokenKind.CommandArgument: {
                    const command = this.curNode as Command;

                    command.arg = {
                        value: scanner.tokenText,
                        range: this.rangeAt(scanner.tokenStart, scanner.tokenEnd),
                    };

                    if (command.arg.value[0] === ':') {
                        command.arg.value = command.arg.value.slice(1);
                        command.arg.range.start.offset++;
                        command.arg.range.start.col!++;
                    }

                    break;
                }
                case TokenKind.CommandModifier: {
                    const command = this.curNode as Command;
                    const name = scanner.tokenText.slice(1);

                    if (!command.modifiers) {
                        command.modifiers = [];
                    }

                    const modifier = {
                        value: name,
                        range: this.rangeAt(scanner.tokenStart + 1, scanner.tokenEnd),
                    };

                    if (command.modifiers.find(({ value }) => value === name)) {
                        this.warnings.push({
                            message: 'Command modifier duplicate.',
                            range: clone(modifier.range),
                        });
                    }

                    command.modifiers.push(modifier);

                    break;
                }
                case TokenKind.ContentMustacheStart: {
                    const attr = this.curNode as Attribute;

                    if (!attr.children) {
                        attr.children = [];
                    }

                    const mustache: ContentMustache = {
                        type: NodeType.ContentMustache,
                        text: '',
                        parent: attr,
                        range: {
                            start: this.positionAt(scanner.tokenStart),
                            end: utils.nullLoc,
                        },
                    };

                    attr.children.push(mustache);
                    this.curNode = mustache;

                    break;
                }
                case TokenKind.ContentMustacheEnd: {
                    this.curNode.range.end = this.positionAt(scanner.tokenEnd);
                    this.curNode = this.curNode.parent as Node;
                    break;
                }
                case TokenKind.ContentMustache: {
                    (this.curNode as ContentMustache).text = scanner.tokenText;
                    break;
                }
                // TODO:
                case TokenKind.Script: {
                    (this.curNode as Script).text = scanner.tokenText;
                    break;
                }
                // TODO:
                case TokenKind.Style: {
                    (this.curNode as Style).text = scanner.tokenText;
                    break;
                }
                case TokenKind.Whitespace: {
                    break;
                }
                case TokenKind.Unknown: {
                    this.errors.push({
                        message: scanner.tokenError ?? '',
                        range: this.rangeAt(scanner.tokenStart, scanner.tokenEnd),
                    });

                    break;
                }
            }

            if (scanner.tokenError && scanner.TokenKind !== TokenKind.Unknown) {
                this.errors.push({
                    message: scanner.tokenError,
                    range: this.rangeAt(scanner.tokenStart, scanner.tokenEnd),
                });
            }

            this.token = scanner.scan();
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
