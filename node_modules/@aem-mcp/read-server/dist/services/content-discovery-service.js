/**
 * Content Discovery Service for AEMaaCS read operations
 * Handles page listing, content retrieval, and JCR node traversal
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class ContentDiscoveryService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * List pages with depth control and pagination
     */
    async listPages(rootPath, options = {}) {
        try {
            this.logger.debug('Listing pages', { rootPath, options });
            if (!rootPath) {
                throw new AEMException('Root path is required', 'VALIDATION_ERROR', false);
            }
            const params = {
                path: rootPath,
                depth: options.depth !== undefined ? options.depth : 1
            };
            if (options.filter) {
                params.filter = options.filter;
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 60000, // Cache for 1 minute
                context: {
                    operation: 'listPages',
                    resource: rootPath
                }
            };
            // Use the standard AEM JSON export with depth selector
            const jsonPath = `${rootPath}.${params.depth}.json`;
            const response = await this.client.get(jsonPath, {}, requestOptions);
            // Log detailed response for debugging
            this.logger.debug('AEM listPages response', {
                rootPath,
                jsonPath,
                success: response.success,
                hasData: !!response.data,
                error: response.error,
                metadata: response.metadata
            });
            if (!response.success || !response.data) {
                // Log the full error details
                const listError = new Error(`Failed to list pages at ${rootPath}`);
                this.logger.error('Failed to list pages - response details', listError, {
                    rootPath,
                    jsonPath,
                    responseSuccess: response.success,
                    responseError: response.error,
                    responseData: response.data,
                    metadata: response.metadata
                });
                throw new AEMException(`Failed to list pages at ${rootPath}`, response.error?.code || 'SERVER_ERROR', response.error?.recoverable !== false, response.error?.retryAfter, { response, jsonPath });
            }
            // Parse the page list response
            let pages = this.parsePageListResponse(response.data, rootPath);
            // Apply client-side filtering and sorting
            if (options.orderBy) {
                pages = this.sortPages(pages, options.orderBy, options.orderDirection);
            }
            if (options.limit || options.offset) {
                const start = options.offset || 0;
                const end = options.limit ? start + options.limit : undefined;
                pages = pages.slice(start, end);
            }
            this.logger.debug('Successfully listed pages', {
                rootPath,
                count: pages.length
            });
            return {
                success: true,
                data: pages,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to list pages', error, { rootPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while listing pages at ${rootPath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, rootPath });
        }
    }
    /**
     * List children nodes with JCR node traversal
     */
    async listChildren(nodePath, options = {}) {
        try {
            this.logger.debug('Listing children nodes', { nodePath, options });
            if (!nodePath) {
                throw new AEMException('Node path is required', 'VALIDATION_ERROR', false);
            }
            const params = {
                path: nodePath,
                depth: options.depth !== undefined ? options.depth : 1
            };
            if (options.primaryType) {
                params.primaryType = Array.isArray(options.primaryType)
                    ? options.primaryType.join(',')
                    : options.primaryType;
            }
            if (options.properties && options.properties.length > 0) {
                params.properties = options.properties.join(',');
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 60000, // Cache for 1 minute
                context: {
                    operation: 'listChildren',
                    resource: nodePath
                }
            };
            const response = await this.client.get('/bin/wcm/contentfinder/content.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Failed to list children at ${nodePath}`, 'SERVER_ERROR', true, undefined, { response });
            }
            // Parse the node list response
            let nodes = this.parseNodeListResponse(response.data, nodePath);
            // Apply pagination
            if (options.limit || options.offset) {
                const start = options.offset || 0;
                const end = options.limit ? start + options.limit : undefined;
                nodes = nodes.slice(start, end);
            }
            this.logger.debug('Successfully listed children nodes', {
                nodePath,
                count: nodes.length
            });
            return {
                success: true,
                data: nodes,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to list children nodes', error, { nodePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while listing children at ${nodePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, nodePath });
        }
    }
    /**
     * Get complete page content with components
     */
    async getPageContent(pagePath) {
        try {
            this.logger.debug('Getting page content', { pagePath });
            if (!pagePath) {
                throw new AEMException('Page path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 60000, // Cache for 1 minute
                context: {
                    operation: 'getPageContent',
                    resource: pagePath
                }
            };
            // Get page content with components
            const response = await this.client.get(`${pagePath}.infinity.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Page not found: ${pagePath}`, 'NOT_FOUND_ERROR', false, undefined, { pagePath });
            }
            const pageContent = this.parsePageContentResponse(response.data, pagePath);
            this.logger.debug('Successfully retrieved page content', {
                pagePath,
                componentCount: pageContent.components.length
            });
            return {
                success: true,
                data: pageContent,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get page content', error, { pagePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting page content for ${pagePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, pagePath });
        }
    }
    /**
     * Get page properties and metadata
     */
    async getPageProperties(pagePath) {
        try {
            this.logger.debug('Getting page properties', { pagePath });
            if (!pagePath) {
                throw new AEMException('Page path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getPageProperties',
                    resource: pagePath
                }
            };
            // Get page properties
            const response = await this.client.get(`${pagePath}/jcr:content.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Page not found: ${pagePath}`, 'NOT_FOUND_ERROR', false, undefined, { pagePath });
            }
            const pageProperties = this.parsePagePropertiesResponse(response.data, pagePath);
            this.logger.debug('Successfully retrieved page properties', { pagePath });
            return {
                success: true,
                data: pageProperties,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get page properties', error, { pagePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting page properties for ${pagePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, pagePath });
        }
    }
    /**
     * Get node content with depth control
     */
    async getNodeContent(nodePath, options = {}) {
        try {
            this.logger.debug('Getting node content', { nodePath, options });
            if (!nodePath) {
                throw new AEMException('Node path is required', 'VALIDATION_ERROR', false);
            }
            const depth = options.depth !== undefined ? options.depth : 1;
            const suffix = depth === 0 ? '.json' : `.${depth}.json`;
            const requestOptions = {
                cache: true,
                cacheTtl: 60000, // Cache for 1 minute
                context: {
                    operation: 'getNodeContent',
                    resource: nodePath
                }
            };
            // Get node content
            const response = await this.client.get(`${nodePath}${suffix}`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Node not found: ${nodePath}`, 'NOT_FOUND_ERROR', false, undefined, { nodePath });
            }
            const nodeContent = this.parseNodeContentResponse(response.data, nodePath);
            this.logger.debug('Successfully retrieved node content', {
                nodePath,
                depth,
                childCount: nodeContent.children?.length || 0
            });
            return {
                success: true,
                data: nodeContent,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get node content', error, { nodePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting node content for ${nodePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, nodePath });
        }
    }
    /**
     * Parse page list response from AEM
     */
    parsePageListResponse(data, rootPath) {
        try {
            if (!data || !data.pages) {
                return [];
            }
            const pages = [];
            // Handle different response formats
            if (Array.isArray(data.pages)) {
                for (const page of data.pages) {
                    const parsedPage = this.mapToPage(page);
                    if (parsedPage) {
                        pages.push(parsedPage);
                    }
                }
            }
            else if (typeof data.pages === 'object') {
                // Handle object format where keys are paths
                for (const key of Object.keys(data.pages)) {
                    const page = data.pages[key];
                    const parsedPage = this.mapToPage(page);
                    if (parsedPage) {
                        pages.push(parsedPage);
                    }
                }
            }
            return pages;
        }
        catch (error) {
            this.logger.error('Failed to parse page list response', error, { data, rootPath });
            return [];
        }
    }
    /**
     * Parse node list response from AEM
     */
    parseNodeListResponse(data, nodePath) {
        try {
            if (!data || !data.hits) {
                return [];
            }
            const nodes = [];
            if (Array.isArray(data.hits)) {
                for (const hit of data.hits) {
                    const parsedNode = this.mapToContentNode(hit);
                    if (parsedNode) {
                        nodes.push(parsedNode);
                    }
                }
            }
            return nodes;
        }
        catch (error) {
            this.logger.error('Failed to parse node list response', error, { data, nodePath });
            return [];
        }
    }
    /**
     * Parse page content response from AEM
     */
    parsePageContentResponse(data, pagePath) {
        try {
            // Extract basic page info
            const page = this.mapToPage({
                path: pagePath,
                ...data
            });
            if (!page) {
                throw new Error(`Invalid page data for ${pagePath}`);
            }
            // Extract components
            const components = this.extractPageComponents(data);
            // Extract child pages if available
            const childPages = this.extractChildPages(data);
            return {
                ...page,
                components,
                childPages
            };
        }
        catch (error) {
            this.logger.error('Failed to parse page content response', error, { pagePath });
            throw new Error(`Invalid page content response for ${pagePath}`);
        }
    }
    /**
     * Parse page properties response from AEM
     */
    parsePagePropertiesResponse(data, pagePath) {
        try {
            const pathParts = pagePath.split('/');
            const name = pathParts[pathParts.length - 1];
            return {
                path: pagePath,
                name,
                title: data['jcr:title'] || name,
                template: data['cq:template'],
                created: data['jcr:created'] ? new Date(data['jcr:created']) : undefined,
                lastModified: data['cq:lastModified'] ? new Date(data['cq:lastModified']) : undefined,
                lastPublished: data['cq:lastReplicated'] ? new Date(data['cq:lastReplicated']) : undefined,
                properties: { ...data }
            };
        }
        catch (error) {
            this.logger.error('Failed to parse page properties response', error, { pagePath });
            throw new Error(`Invalid page properties response for ${pagePath}`);
        }
    }
    /**
     * Parse node content response from AEM
     */
    parseNodeContentResponse(data, nodePath) {
        try {
            return this.mapToContentNode({
                path: nodePath,
                ...data
            });
        }
        catch (error) {
            this.logger.error('Failed to parse node content response', error, { nodePath });
            throw new Error(`Invalid node content response for ${nodePath}`);
        }
    }
    /**
     * Map AEM page data to Page interface
     */
    mapToPage(data) {
        try {
            if (!data || !data.path) {
                return null;
            }
            const pathParts = data.path.split('/');
            const name = pathParts[pathParts.length - 1];
            return {
                path: data.path,
                name,
                primaryType: data['jcr:primaryType'] || 'cq:Page',
                title: data['jcr:title'] || data.title || name,
                lastModified: data['cq:lastModified'] ? new Date(data['cq:lastModified']) : undefined,
                properties: { ...data },
                template: data['cq:template'] || '',
                resourceType: data['sling:resourceType'] || 'cq/Page',
                published: Boolean(data['cq:lastReplicated']),
                lastReplicated: data['cq:lastReplicated'] ? new Date(data['cq:lastReplicated']) : undefined,
                children: this.extractChildNodes(data)
            };
        }
        catch (error) {
            this.logger.error('Failed to map page data', error, { data });
            return null;
        }
    }
    /**
     * Map AEM node data to ContentNode interface
     */
    mapToContentNode(data) {
        try {
            if (!data || !data.path) {
                throw new Error('Invalid node data: missing path');
            }
            const pathParts = data.path.split('/');
            const name = pathParts[pathParts.length - 1];
            return {
                path: data.path,
                name,
                primaryType: data['jcr:primaryType'] || 'nt:unstructured',
                title: data['jcr:title'] || data.title,
                lastModified: data['jcr:lastModified'] ? new Date(data['jcr:lastModified']) : undefined,
                properties: { ...data },
                children: this.extractChildNodes(data)
            };
        }
        catch (error) {
            this.logger.error('Failed to map content node data', error, { data });
            throw error;
        }
    }
    /**
     * Extract child nodes from data
     */
    extractChildNodes(data) {
        const children = [];
        // Skip known properties that aren't child nodes
        const skipProps = [
            'jcr:primaryType', 'jcr:mixinTypes', 'jcr:created', 'jcr:createdBy',
            'jcr:lastModified', 'jcr:lastModifiedBy', 'sling:resourceType',
            'cq:template', 'cq:lastReplicated', 'cq:lastReplicatedBy', 'cq:lastReplicationAction'
        ];
        for (const key of Object.keys(data)) {
            if (skipProps.includes(key))
                continue;
            const value = data[key];
            if (value && typeof value === 'object' && !Array.isArray(value) && value['jcr:primaryType']) {
                try {
                    const childPath = data.path ? `${data.path}/${key}` : key;
                    const childNode = this.mapToContentNode({
                        path: childPath,
                        name: key,
                        ...value
                    });
                    children.push(childNode);
                }
                catch (error) {
                    // Skip invalid child nodes
                    continue;
                }
            }
        }
        return children.length > 0 ? children : undefined;
    }
    /**
     * Extract page components from data
     */
    extractPageComponents(data) {
        const components = [];
        // Look for the jcr:content node which contains components
        const content = data['jcr:content'];
        if (!content)
            return components;
        // Process root content as a component
        const rootComponent = {
            path: `${data.path}/jcr:content`,
            resourceType: content['sling:resourceType'] || 'unknown',
            properties: { ...content },
            children: []
        };
        // Process child components recursively
        this.extractChildComponents(content, rootComponent.path, rootComponent.children);
        components.push(rootComponent);
        return components;
    }
    /**
     * Extract child components recursively
     */
    extractChildComponents(data, parentPath, result) {
        // Skip known properties that aren't components
        const skipProps = [
            'jcr:primaryType', 'jcr:mixinTypes', 'jcr:created', 'jcr:createdBy',
            'jcr:lastModified', 'jcr:lastModifiedBy'
        ];
        for (const key of Object.keys(data)) {
            if (skipProps.includes(key))
                continue;
            const value = data[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const componentPath = `${parentPath}/${key}`;
                const resourceType = value['sling:resourceType'];
                // Only include items with a resource type as components
                if (resourceType) {
                    const component = {
                        path: componentPath,
                        resourceType,
                        properties: { ...value },
                        children: []
                    };
                    // Process child components recursively
                    this.extractChildComponents(value, componentPath, component.children);
                    // Only add children array if it has items
                    if (component.children.length === 0) {
                        delete component.children;
                    }
                    result.push(component);
                }
                else {
                    // For non-component objects, still check for nested components
                    this.extractChildComponents(value, componentPath, result);
                }
            }
        }
    }
    /**
     * Extract child pages from data
     */
    extractChildPages(data) {
        const childPages = [];
        for (const key of Object.keys(data)) {
            const value = data[key];
            if (value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                value['jcr:primaryType'] === 'cq:Page') {
                childPages.push(`${data.path}/${key}`);
            }
        }
        return childPages.length > 0 ? childPages : undefined;
    }
    /**
     * Sort pages by specified criteria
     */
    sortPages(pages, orderBy, direction = 'asc') {
        return pages.sort((a, b) => {
            let aValue;
            let bValue;
            switch (orderBy) {
                case 'title':
                    aValue = (a.title || '').toLowerCase();
                    bValue = (b.title || '').toLowerCase();
                    break;
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'path':
                    aValue = a.path.toLowerCase();
                    bValue = b.path.toLowerCase();
                    break;
                case 'modified':
                    aValue = a.lastModified ? a.lastModified.getTime() : 0;
                    bValue = b.lastModified ? b.lastModified.getTime() : 0;
                    break;
                default:
                    aValue = (a.title || '').toLowerCase();
                    bValue = (b.title || '').toLowerCase();
            }
            if (aValue < bValue) {
                return direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
}
//# sourceMappingURL=content-discovery-service.js.map