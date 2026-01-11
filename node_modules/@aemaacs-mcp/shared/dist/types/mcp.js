/**
 * Model Context Protocol (MCP) types and interfaces
 */
export var MCPErrorCode;
(function (MCPErrorCode) {
    MCPErrorCode[MCPErrorCode["PARSE_ERROR"] = -32700] = "PARSE_ERROR";
    MCPErrorCode[MCPErrorCode["INVALID_REQUEST"] = -32600] = "INVALID_REQUEST";
    MCPErrorCode[MCPErrorCode["METHOD_NOT_FOUND"] = -32601] = "METHOD_NOT_FOUND";
    MCPErrorCode[MCPErrorCode["INVALID_PARAMS"] = -32602] = "INVALID_PARAMS";
    MCPErrorCode[MCPErrorCode["INTERNAL_ERROR"] = -32603] = "INTERNAL_ERROR";
    MCPErrorCode[MCPErrorCode["SERVER_ERROR_START"] = -32099] = "SERVER_ERROR_START";
    MCPErrorCode[MCPErrorCode["SERVER_ERROR_END"] = -32000] = "SERVER_ERROR_END";
})(MCPErrorCode || (MCPErrorCode = {}));
//# sourceMappingURL=mcp.js.map