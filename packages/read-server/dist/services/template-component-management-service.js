/**
 * Template and Component Management Service for AEMaaCS read operations
 * Handles template discovery, component usage analysis, and dependency tracking
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
export class TemplateComponentManagementService {
    constructor(client) {
        this.client = client;
        this.logger = Logger.getInstance();
    }
    /**
     * Discover all available templates
     */
    async discoverTemplates(sitePath) {
        try {
            this.logger.debug('Discovering templates', { sitePath });
            const requestOptions = {
                cache: true,
                cacheTtl: 600000, // Cache for 10 minutes
                context: {
                    operation: 'discoverTemplates',
                    resource: sitePath || '/conf'
                }
            };
            const params = {};
            if (sitePath) {
                params['sitePath'] = sitePath;
            }
            const response = await this.client.get('/conf/templates.json', params, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to discover templates', 'SERVER_ERROR', true, undefined, { response });
            }
            const templates = this.parseTemplatesResponse(response.data, sitePath);
            this.logger.debug('Successfully discovered templates', {
                templateCount: templates.length,
                sitePath
            });
            return {
                success: true,
                data: templates,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to discover templates', error, { sitePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while discovering templates`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, sitePath });
        }
    }
    /**
     * Analyze component usage across the site
     */
    async analyzeComponentUsage(componentPath, options = {}) {
        try {
            this.logger.debug('Analyzing component usage', { componentPath, options });
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'analyzeComponentUsage',
                    resource: componentPath || '/content'
                }
            };
            const params = {};
            if (componentPath) {
                params['componentPath'] = componentPath;
            }
            if (options.resourceType) {
                params['resourceType'] = options.resourceType;
            }
            if (options.includeInherited !== undefined) {
                params['includeInherited'] = options.includeInherited;
            }
            const response = await this.client.get('/bin/querybuilder.json', {
                ...params,
                type: 'cq:Component',
                path: '/apps',
                'p.limit': 1000
            }, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to analyze component usage', 'SERVER_ERROR', true, undefined, { response });
            }
            const componentUsages = await this.processComponentUsage(response.data, options);
            this.logger.debug('Successfully analyzed component usage', {
                componentCount: componentUsages.length
            });
            return {
                success: true,
                data: componentUsages,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze component usage', error, { componentPath, options });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while analyzing component usage`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, componentPath, options });
        }
    }
    /**
     * Track component dependencies
     */
    async trackComponentDependencies(componentPath, options = {}) {
        try {
            this.logger.debug('Tracking component dependencies', { componentPath, options });
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'trackComponentDependencies',
                    resource: componentPath || '/apps'
                }
            };
            const params = {};
            if (componentPath) {
                params['componentPath'] = componentPath;
            }
            if (options.includeInherited !== undefined) {
                params['includeInherited'] = options.includeInherited;
            }
            if (options.maxDepth) {
                params['maxDepth'] = options.maxDepth;
            }
            const response = await this.client.get('/bin/querybuilder.json', {
                ...params,
                type: 'cq:Component',
                path: '/apps',
                'p.limit': 1000
            }, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to track component dependencies', 'SERVER_ERROR', true, undefined, { response });
            }
            const dependencies = await this.processComponentDependencies(response.data, options);
            this.logger.debug('Successfully tracked component dependencies', {
                dependencyCount: dependencies.length
            });
            return {
                success: true,
                data: dependencies,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to track component dependencies', error, { componentPath, options });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while tracking component dependencies`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, componentPath, options });
        }
    }
    /**
     * Analyze template structure and components
     */
    async analyzeTemplateStructure(templatePath) {
        try {
            this.logger.debug('Analyzing template structure', { templatePath });
            if (!templatePath) {
                throw new AEMException('Template path is required', 'VALIDATION_ERROR', false);
            }
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'analyzeTemplateStructure',
                    resource: templatePath
                }
            };
            const response = await this.client.get(`${templatePath}/jcr:content/structure.json`, undefined, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException(`Template structure not found: ${templatePath}`, 'NOT_FOUND_ERROR', false, undefined, { templatePath });
            }
            const analysis = await this.processTemplateAnalysis(response.data, templatePath);
            this.logger.debug('Successfully analyzed template structure', {
                templatePath,
                componentCount: analysis.componentCount
            });
            return {
                success: true,
                data: analysis,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze template structure', error, { templatePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while analyzing template structure for ${templatePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, templatePath });
        }
    }
    /**
     * Get component usage statistics
     */
    async getComponentUsageStatistics(componentPath) {
        try {
            this.logger.debug('Getting component usage statistics', { componentPath });
            const requestOptions = {
                cache: true,
                cacheTtl: 300000, // Cache for 5 minutes
                context: {
                    operation: 'getComponentUsageStatistics',
                    resource: componentPath || '/content'
                }
            };
            const params = {};
            if (componentPath) {
                params['componentPath'] = componentPath;
            }
            const response = await this.client.get('/bin/querybuilder.json', {
                ...params,
                type: 'cq:Component',
                path: '/apps',
                'p.limit': 1000
            }, requestOptions);
            if (!response.success || !response.data) {
                throw new AEMException('Failed to get component usage statistics', 'SERVER_ERROR', true, undefined, { response });
            }
            const statistics = this.processUsageStatistics(response.data);
            this.logger.debug('Successfully retrieved component usage statistics', {
                componentCount: statistics.totalComponents
            });
            return {
                success: true,
                data: statistics,
                metadata: {
                    timestamp: new Date(),
                    requestId: response.metadata?.requestId || '',
                    duration: response.metadata?.duration || 0,
                    cached: response.metadata?.cached
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get component usage statistics', error, { componentPath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting component usage statistics`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, componentPath });
        }
    }
    /**
     * Parse templates response
     */
    parseTemplatesResponse(data, sitePath) {
        const templates = [];
        if (data.templates) {
            for (const templateData of data.templates) {
                templates.push({
                    path: templateData.path,
                    title: templateData.title || templateData['jcr:title'],
                    description: templateData.description || templateData['jcr:description'],
                    resourceType: templateData.resourceType,
                    allowedPaths: templateData.allowedPaths || [],
                    allowedChildren: templateData.allowedChildren || [],
                    initialContent: templateData.initialContent,
                    policies: this.parseTemplatePolicies(templateData.policies || []),
                    lastModified: templateData.lastModified ? new Date(templateData.lastModified) : new Date(),
                    createdBy: templateData.createdBy
                });
            }
        }
        return templates;
    }
    /**
     * Parse template policies
     */
    parseTemplatePolicies(policiesData) {
        return policiesData.map(policy => ({
            name: policy.name,
            path: policy.path,
            title: policy.title || policy['jcr:title'],
            description: policy.description || policy['jcr:description'],
            allowedComponents: policy.allowedComponents || [],
            allowedChildren: policy.allowedChildren || []
        }));
    }
    /**
     * Process component usage data
     */
    async processComponentUsage(data, options) {
        const componentUsages = [];
        const hits = data.hits || [];
        for (const hit of hits) {
            try {
                // Get component details
                const componentPath = hit.path;
                const componentTitle = hit.title || hit['jcr:title'] || componentPath.split('/').pop();
                // Find usage across pages
                const usagePages = await this.findComponentUsagePages(componentPath);
                const usage = {
                    componentPath,
                    componentTitle,
                    usageCount: usagePages.length,
                    pages: usagePages,
                    templates: this.extractTemplatesFromPages(usagePages),
                    lastUsed: this.getLastUsedDate(usagePages)
                };
                componentUsages.push(usage);
            }
            catch (error) {
                this.logger.warn('Failed to process component usage', { componentPath: hit.path, error: error.message });
            }
        }
        return componentUsages;
    }
    /**
     * Process component dependencies
     */
    async processComponentDependencies(data, options) {
        const dependencies = [];
        const hits = data.hits || [];
        for (const hit of hits) {
            try {
                const componentPath = hit.path;
                const componentDeps = await this.analyzeComponentDependencies(componentPath, options);
                dependencies.push(componentDeps);
            }
            catch (error) {
                this.logger.warn('Failed to process component dependencies', { componentPath: hit.path, error: error.message });
            }
        }
        return dependencies;
    }
    /**
     * Process template analysis
     */
    async processTemplateAnalysis(data, templatePath) {
        const components = [];
        if (data.components) {
            for (const compData of data.components) {
                components.push({
                    componentPath: compData.path,
                    componentTitle: compData.title || compData['jcr:title'],
                    allowed: compData.allowed !== false,
                    defaultContent: compData.defaultContent,
                    policies: compData.policies || []
                });
            }
        }
        // Find pages using this template
        const usagePages = await this.findTemplateUsagePages(templatePath);
        return {
            templatePath,
            templateTitle: data.title || data['jcr:title'],
            componentCount: components.length,
            components,
            dependencies: data.dependencies || [],
            usageCount: usagePages.length,
            pages: usagePages
        };
    }
    /**
     * Process usage statistics
     */
    processUsageStatistics(data) {
        const hits = data.hits || [];
        return {
            totalComponents: hits.length,
            mostUsedComponents: this.getMostUsedComponents(hits),
            unusedComponents: this.getUnusedComponents(hits),
            componentCategories: this.categorizeComponents(hits)
        };
    }
    /**
     * Find component usage pages
     */
    async findComponentUsagePages(componentPath) {
        try {
            const response = await this.client.get('/bin/querybuilder.json', {
                type: 'cq:Page',
                'property': 'jcr:content/sling:resourceType',
                'property.value': componentPath,
                'p.limit': 1000
            });
            if (response.success && response.data) {
                const hits = response.data.hits || [];
                return hits.map((hit) => ({
                    pagePath: hit.path,
                    pageTitle: hit.title || hit['jcr:title'],
                    template: hit.template || 'unknown',
                    lastModified: hit.lastModified ? new Date(hit.lastModified) : new Date()
                }));
            }
        }
        catch (error) {
            this.logger.warn('Failed to find component usage pages', { componentPath, error: error.message });
        }
        return [];
    }
    /**
     * Analyze component dependencies
     */
    async analyzeComponentDependencies(componentPath, options) {
        const dependencies = [];
        const dependents = [];
        const circularDependencies = [];
        try {
            // Get component details to find dependencies
            const response = await this.client.get(`${componentPath}.json`);
            if (response.success && response.data) {
                const componentData = response.data;
                // Find sling:resourceSuperType dependencies
                if (componentData['sling:resourceSuperType']) {
                    dependencies.push({
                        componentPath: componentData['sling:resourceSuperType'],
                        componentTitle: componentData['sling:resourceSuperType'].split('/').pop(),
                        dependencyType: 'sling:resourceSuperType',
                        required: true
                    });
                }
                // Find other dependencies
                if (componentData.dependencies) {
                    for (const dep of componentData.dependencies) {
                        dependencies.push({
                            componentPath: dep.path,
                            componentTitle: dep.title || dep.path.split('/').pop(),
                            dependencyType: dep.type || 'reference',
                            required: dep.required !== false
                        });
                    }
                }
            }
        }
        catch (error) {
            this.logger.warn('Failed to analyze component dependencies', { componentPath, error: error.message });
        }
        return {
            componentPath,
            dependencies,
            dependents,
            circularDependencies
        };
    }
    /**
     * Find template usage pages
     */
    async findTemplateUsagePages(templatePath) {
        try {
            const response = await this.client.get('/bin/querybuilder.json', {
                type: 'cq:Page',
                'property': 'jcr:content/cq:template',
                'property.value': templatePath,
                'p.limit': 1000
            });
            if (response.success && response.data) {
                const hits = response.data.hits || [];
                return hits.map((hit) => hit.path);
            }
        }
        catch (error) {
            this.logger.warn('Failed to find template usage pages', { templatePath, error: error.message });
        }
        return [];
    }
    /**
     * Extract templates from pages
     */
    extractTemplatesFromPages(pages) {
        const templates = new Set();
        pages.forEach(page => templates.add(page.template));
        return Array.from(templates);
    }
    /**
     * Get last used date from pages
     */
    getLastUsedDate(pages) {
        if (pages.length === 0)
            return undefined;
        const sortedPages = pages.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
        return sortedPages[0].lastModified;
    }
    /**
     * Get most used components
     */
    getMostUsedComponents(hits) {
        // This would need to be implemented with actual usage data
        return hits.slice(0, 10).map(hit => ({
            path: hit.path,
            title: hit.title || hit['jcr:title'],
            usageCount: 0 // Would need actual usage calculation
        }));
    }
    /**
     * Get unused components
     */
    getUnusedComponents(hits) {
        // This would need to be implemented with actual usage data
        return hits.filter(hit => {
            // Would need to check actual usage
            return false;
        });
    }
    /**
     * Categorize components
     */
    categorizeComponents(hits) {
        const categories = {};
        hits.forEach(hit => {
            const category = hit.category || 'uncategorized';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({
                path: hit.path,
                title: hit.title || hit['jcr:title']
            });
        });
        return categories;
    }
}
//# sourceMappingURL=template-component-management-service.js.map