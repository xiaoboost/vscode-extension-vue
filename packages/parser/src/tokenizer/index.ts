import { CodePointer } from './pointer';
import { TokenKind, ScannerState } from './types';
import { code, errorText, scriptEndTagCodes, styleEndTagCodes } from './constant';

export * from './types';

const ElementName = /^[_:\w][_:\w-.\d]*/;
const CommandRegCommon = '\\s"\'></=\\x00-\\x0F\\x7F\\x80-\\x9F';
const AttributeName = new RegExp(`^[^${CommandRegCommon}]*`);
const CommandName = new RegExp(`^[^:.${CommandRegCommon}]*`);
const CommandArg = new RegExp(`^[:.]?[^.${CommandRegCommon}]*`);

/** Token 标记扫描器 */
export class Scanner {
    private _pointer: CodePointer;
    private _TokenKind = TokenKind.Unknown;
    private _tokenStart = 0;
    private _tokenError?: string;
    private _state = ScannerState.WithinContent;

    private _lastTag = '';
    private _hasSpaceAfterTag = false;
    private _lastAttrMark: number | null = null;
    private _lastState = ScannerState.WithinContent;

    constructor(code: string) {
        this._pointer = new CodePointer(code);
    }

    get state() {
        return this._state;
    }
    set state(val: ScannerState) {
        this._lastState = this._state;
        this._state = val;
    }

    get TokenKind() {
        return this._TokenKind;
    }

    get tokenStart() {
        return this._tokenStart;
    }

    get tokenLength() {
        return this._pointer.pos - this._tokenStart;
    }

    get tokenEnd() {
        return this._pointer.pos;
    }

    get tokenText() {
        return this._pointer.source.substring(this._tokenStart, this._pointer.pos);
    }

    get tokenError() {
        return this._tokenError;
    }

    private finishToken(startOffset: number, type: TokenKind, errorMessage?: string) {
        this._TokenKind = type;
        this._tokenStart = startOffset;
        this._tokenError = errorMessage;

        return type;
    }

    /** 扫描下一个标记 */
    scan(): TokenKind {
        const { _pointer: pointer } = this;

        if (pointer.eos) {
            return this.finishToken(pointer.pos, TokenKind.EOS);
        }

        let errorMessage = '';
        const startOffset = pointer.pos;

        switch (this.state) {
            case ScannerState.WithinComment: {
                // '-->'
                if (pointer.advanceIfChars([code.MIN, code.MIN, code.RAN])) {
                    this.state = ScannerState.WithinContent;
                    return this.finishToken(startOffset, TokenKind.EndCommentTag);
                }

                // '-->'
                pointer.advanceUntilChars([code.MIN, code.MIN, code.RAN]);
                return this.finishToken(startOffset, TokenKind.Comment);
            }
            case ScannerState.WithinContent: {
                // '<'
                if (pointer.advanceIfChar(code.LAN)) {
                    // '!'
                    if (!pointer.eos && pointer.peekChar() === code.BNG) {
                        // '<!--'
                        if (pointer.advanceIfChars([code.BNG, code.MIN, code.MIN])) {
                            this.state = ScannerState.WithinComment;
                            return this.finishToken(startOffset, TokenKind.StartCommentTag);
                        }
                    }

                    // '/'
                    if (pointer.advanceIfChar(code.FSL)) {
                        this.state = ScannerState.AfterOpeningEndTag;
                        return this.finishToken(startOffset, TokenKind.EndTagOpen);
                    }

                    this.state = ScannerState.AfterOpeningStartTag;
                    return this.finishToken(startOffset, TokenKind.StartTagOpen);
                }
                // '{{'
                else if (pointer.advanceIfChars([code.LBR, code.LBR])) {
                    this.state = ScannerState.WithinMustache;
                    return this.finishToken(startOffset, TokenKind.ContentMustacheStart);
                }
                // 纯文本，直到 '{{' 或者 '<'
                else {
                    pointer.advanceUntilRegExp(/({{|<)/);
                    return this.finishToken(startOffset, TokenKind.Content);
                }
            }
            case ScannerState.AfterOpeningEndTag: {
                const tagName = pointer.advanceIfRegExp(ElementName);

                if (tagName.length > 0) {
                    this.state = ScannerState.WithinEndTag;
                    return this.finishToken(startOffset, TokenKind.EndTag);
                }

                // 非法空格
                if (pointer.skipWhitespace()) {
                    return this.finishToken(startOffset, TokenKind.Whitespace, errorText.unexpectedWhitespace);
                }

                this.state = ScannerState.WithinEndTag;
                pointer.advanceUntilChar(code.RAN);

                if (startOffset < pointer.pos) {
                    return this.finishToken(startOffset, TokenKind.Unknown, errorText.endTagNameExpected);
                }

                return this.scan();
            }
            case ScannerState.WithinEndTag: {
                // 非法空格
                if (pointer.skipWhitespace()) {
                    return this.finishToken(startOffset, TokenKind.Whitespace);
                }

                // '>'
                if (pointer.advanceIfChar(code.RAN)) {
                    this.state = ScannerState.WithinContent;
                    return this.finishToken(startOffset, TokenKind.EndTagClose);
                }

                // '<'
                if (pointer.peekChar() === code.LAN) {
                    this.state = ScannerState.WithinContent;
                    return this.finishToken(startOffset, TokenKind.EndTagClose, errorText.closingBracketMissing);
                }

                errorMessage = errorText.closingBracketExpected;
                break;
            }
            case ScannerState.AfterOpeningStartTag: {
                this._lastTag = pointer.advanceIfRegExp(ElementName);

                if (this._lastTag.length > 0) {
                    this._hasSpaceAfterTag = false;
                    this.state = ScannerState.WithinTag;
                    return this.finishToken(startOffset, TokenKind.StartTag);
                }

                // 非法空白
                if (pointer.skipWhitespace()) {
                    return this.finishToken(startOffset, TokenKind.Whitespace, errorText.unexpectedWhitespace);
                }

                // 结束标签
                if (pointer.advanceIfChars([code.LAN, code.FSL])) {
                    this.state = ScannerState.AfterOpeningEndTag;
                    return this.finishToken(startOffset, TokenKind.EndTagOpen);
                }

                this.state = ScannerState.WithinTag;
                pointer.advanceUntilChar(code.RAN);

                if (startOffset < pointer.pos) {
                    return this.finishToken(startOffset, TokenKind.Unknown, errorText.startTagNameExpected);
                }

                return this.scan();
            }
            case ScannerState.WithinTag: {
                // 跳过空白
                if (pointer.skipWhitespace()) {
                    this._hasSpaceAfterTag = true;
                    return this.finishToken(startOffset, TokenKind.Whitespace);
                }

                // 确实跳过了空白，接下来才允许是属性名称
                if (this._hasSpaceAfterTag) {
                    // '@' or ':'
                    if (pointer.advanceIfOrChar([code.AT, code.COL])) {
                        this.state = ScannerState.WithinCommand;
                        return this.finishToken(startOffset, TokenKind.CommandShortName);
                    }
    
                    // v-
                    if (pointer.advanceIfChars([code.VChar, code.MIN])) {
                        pointer.advanceIfRegExp(CommandName);
                        this.state = ScannerState.WithinCommand;
                        return this.finishToken(startOffset, TokenKind.CommandName);
                    }

                    // 属性名称
                    if (pointer.advanceIfRegExp(AttributeName).length > 0) {
                        this._hasSpaceAfterTag = false;
                        this.state = ScannerState.AfterAttributeName;

                        return this.finishToken(startOffset, TokenKind.AttributeName);
                    }
                }

                // '/>'
                if (pointer.advanceIfChars([code.FSL, code.RAN])) {
                    this.state = ScannerState.WithinContent;
                    return this.finishToken(startOffset, TokenKind.StartTagSelfClose);
                }

                // '>'
                if (pointer.advanceIfChar(code.RAN)) {
                    const tagName = this._lastTag.toLowerCase();

                    if (tagName === 'script') {
                        this.state = ScannerState.WithinScriptContent;
                    }
                    else if (tagName === 'style') {
                        this.state = ScannerState.WithinStyleContent;
                    }
                    else {
                        this.state = ScannerState.WithinContent;
                    }

                    return this.finishToken(startOffset, TokenKind.StartTagClose);
                }

                pointer.advance(1);
                return this.finishToken(startOffset, TokenKind.Unknown, errorText.unexpectedCharacterInTag);
            }
            case ScannerState.WithinCommand: {
                const startChar = pointer.peekChar();
                const lastChar = pointer.peekChar(-1);

                // 当前字符是 ':'，或者上一个字符是 '@'、':'
                if (startChar === code.COL || lastChar === code.COL || lastChar === code.AT) {
                    if (pointer.advanceIfRegExp(CommandArg).length > 0) {
                        return this.finishToken(startOffset, TokenKind.CommandArgument);
                    }
                    else {
                        this.finishToken(startOffset, TokenKind.Unknown, errorText.commandArgumentExpected);
                    }
                }

                // '.'
                if (startChar === code.DOT) {
                    if (pointer.advanceIfRegExp(CommandArg).length > 0) {
                        return this.finishToken(startOffset, TokenKind.CommandModifier);
                    }
                    else {
                        this.finishToken(startOffset, TokenKind.Unknown, errorText.commandModifierExpected);
                    }
                }

                // 指令读取完毕
                this.state = ScannerState.AfterAttributeName;
                return this.scan();
            }
            case ScannerState.WithinMustache: {
                const isStart = this._TokenKind === TokenKind.ContentMustacheStart;

                // '}}'
                if (pointer.advanceIfChars([code.RBR, code.RBR])) {
                    this.state = this._lastState;

                    const err = isStart ? errorText.mustacheCannotBeEmpty : undefined;
                    const endType = TokenKind.ContentMustacheEnd;

                    return this.finishToken(startOffset, endType, err);
                }
                // 纯文本，直到 '}}'
                else {
                    const result = pointer.advanceUntilChars([code.RBR, code.RBR]);
                    const err = result ? undefined : errorText.mustacheEndExpected;

                    return this.finishToken(startOffset, TokenKind.ContentMustache, err);
                }
            }
            case ScannerState.AfterAttributeName: {
                // 跳过空白
                if (pointer.skipWhitespace()) {
                    this._hasSpaceAfterTag = true;
                    return this.finishToken(startOffset, TokenKind.Whitespace);
                }

                if (pointer.advanceIfChar(code.EQS)) {
                    this.state = ScannerState.BeforeAttributeValue;
                    return this.finishToken(startOffset, TokenKind.AttributeDelimiter);
                }

                this.state = ScannerState.WithinTag;
                return this.scan();
            }
            case ScannerState.BeforeAttributeValue: {
                // 跳过空白
                if (pointer.skipWhitespace()) {
                    return this.finishToken(startOffset, TokenKind.Whitespace);
                }

                const ch = pointer.peekChar();

                this.state = ScannerState.WithinAttributeValue;

                // 单引号或者双引号
                if (ch === code.SQO || ch === code.DQO) {
                    pointer.advance(1);
                    this._lastAttrMark = ch;
                    return this.finishToken(startOffset, TokenKind.AttributeMark);
                }

                this._lastAttrMark = null;
                return this.scan();
            }
            case ScannerState.WithinAttributeValue: {
                // TODO: attribute 内部也是支持完整 js 语法的，这里也需要按照代码块的需求去识别

                // 存在分割标记
                if (this._lastAttrMark) {
                    if (pointer.advanceIfChar(this._lastAttrMark)) {
                        this.state = ScannerState.WithinTag;
                        return this.finishToken(startOffset, TokenKind.AttributeMark);
                    }
                    else {
                        pointer.advanceUntilChar(this._lastAttrMark);
                        return this.finishToken(startOffset, TokenKind.AttributeValue);
                    }
                }
                else {
                    // 空白
                    if (pointer.skipWhitespace()) {
                        this._hasSpaceAfterTag = true;
                        this.state = ScannerState.WithinTag;
                        return this.finishToken(startOffset, TokenKind.Whitespace);
                    }

                    // '/'
                    if (pointer.advanceIfChar(code.FSL)) {
                        // <foo bar=http://foo/>
                        if (pointer.peekChar() === code.RAN) {
                            pointer.goBack(1);
                            this._hasSpaceAfterTag = false;
                            this.state = ScannerState.WithinContent;
                            return this.finishToken(startOffset, TokenKind.StartTagClose);
                        }
                        else {
                            return this.scan();
                        }
                    }

                    // '>'
                    if (pointer.advanceIfChar(code.RAN)) {
                        this.state = ScannerState.WithinContent;
                        return this.finishToken(startOffset, TokenKind.StartTagClose);
                    }

                    // 纯文本，直到 /> > 以及所有空白字符
                    pointer.advanceUntilRegExp(/(\s|\/>|>)/);
                    return this.finishToken(startOffset, TokenKind.AttributeValue);
                }
            }
            case ScannerState.WithinStyleContent:
            case ScannerState.WithinScriptContent: {
                const tagName = this._state === ScannerState.WithinStyleContent ? 'style' : 'script';
                const closeTag = this._state === ScannerState.WithinStyleContent ? styleEndTagCodes : scriptEndTagCodes;
                const tokenName = this._state === ScannerState.WithinStyleContent ? TokenKind.Style : TokenKind.Script;
                const matcher = new RegExp(`\\/\\*|\\/\\/|'|"|\`|<\\/${tagName.toLowerCase()}\\s*\\/?>?`, 'i');
                const advanceString = (code: number) => {
                    // 下一个还是同样的符号
                    if (pointer.advanceIfChar(code)) {
                        return;
                    }

                    const char = String.fromCharCode(code);
                    const matcher = new RegExp(`[^\\\\${char}]+?${char}`);

                    return pointer.advanceIfRegExp(matcher);
                };

                while (!pointer.eos) {
                    const result = pointer.advanceUntilRegExp(matcher);

                    // 没有匹配到，跳出循环
                    if (!result) {
                        pointer.goToEnd();
                        break;
                    }

                    // '
                    if (pointer.advanceIfChar(code.SQO)) {
                        advanceString(code.SQO);
                    }
                    // '"'
                    else if (pointer.advanceIfChar(code.DQO)) {
                        advanceString(code.DQO);
                    }
                    // '`'
                    else if (pointer.advanceIfChar(code.OSQ)) {
                        advanceString(code.OSQ);
                    }
                    // '/*'
                    else if (pointer.advanceIfChars([code.FSL, code.STA])) {
                        pointer.advanceUntilChars([code.STA, code.FSL], true);
                    }
                    // '//'
                    else if (pointer.advanceIfChars([code.FSL, code.FSL])) {
                        pointer.advanceUntilChar(code.NWL, true);
                    }
                    // '</script|style>'
                    else if (pointer.peekSame(closeTag)) {
                        break;
                    }
                    else {
                        pointer.goToEnd();
                        break;
                    }
                }

                this._state = ScannerState.WithinContent;

                if (startOffset < pointer.pos) {
                    return this.finishToken(startOffset, tokenName);
                }

                return this.scan();
            }
        }

        pointer.advance(1);
        this.state = ScannerState.WithinContent;

        return this.finishToken(pointer.pos, TokenKind.Unknown, errorMessage);
    }
}
