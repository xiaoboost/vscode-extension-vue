export enum TokenType {
    StartCommentTag,
    Comment,
    EndCommentTag,
    StartTagOpen,
    StartTagClose,
    StartTagSelfClose,
    StartTag,
    EndTagOpen,
    EndTagClose,
    EndTag,
    Script,
    Style,
    DelimiterAssign,
    AttributeName,
    AttributeMark,
    AttributeValue,
    Content,
    ContentMustacheStart,
    ContentMustacheEnd,
    ContentMustache,
    Whitespace,
    Unknown,
    EOS,
}

export enum ScannerState {
    /** 标签外文本 */
    WithinContent,
    /** 开标签开始 */
    AfterOpeningStartTag,
    /** 开标签结束 */
    AfterOpeningEndTag,
    /** 开标签内部 */
    WithinTag,
    /** 结束标签内 */
    WithinEndTag,
    /** 注释内 */
    WithinComment,
    /** script 标签内 */
    WithinScriptContent,
    /** style 标签内 */
    WithinStyleContent,
    /** Mustache 表达式内 */
    WithinMustache,
    /** 属性名称之后 */
    AfterAttributeName,
    /** 属性值之前 */
    BeforeAttributeValue,
    /** 属性值内部 */
    WithinAttributeValue,
}