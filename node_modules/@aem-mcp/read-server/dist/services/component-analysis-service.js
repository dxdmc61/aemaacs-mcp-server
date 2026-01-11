/**
 * Component Analysis Service for AEMaaCS read operations
 * Handles component discovery, text extraction, and image reference extraction
 */
import { Logger } from '@aemaacs-mcp/shared';
import { AEMException } from '@aemaacs-mcp/shared';
import { ContentDiscoveryService } from './content-discovery-service.js';
export class ComponentAnalysisService {
    constructor(client, contentDiscoveryService) {
        this.client = client;
        this.logger = Logger.getInstance();
        this.contentDiscoveryService = contentDiscoveryService || new ContentDiscoveryService(client);
    }
    /**
     * Scan page components for discovery
     */
    async scanPageComponents(pagePath) {
        try {
            this.logger.debug('Scanning page components', { pagePath });
            if (!pagePath) {
                throw new AEMException('Page path is required', 'VALIDATION_ERROR', false);
            }
            // Get page content with components
            const pageContentResponse = await this.contentDiscoveryService.getPageContent(pagePath);
            if (!pageContentResponse.success || !pageContentResponse.data) {
                throw new AEMException(`Failed to get page content for ${pagePath}`, 'SERVER_ERROR', true, undefined, { response: pageContentResponse });
            }
            const pageContent = pageContentResponse.data;
            const components = [];
            // Process all components from the page
            this.extractComponentsRecursively(pageContent.components, components);
            const analysis = {
                pagePath,
                pageTitle: pageContent.title,
                template: pageContent.template,
                componentCount: components.length,
                components
            };
            this.logger.debug('Successfully scanned page components', {
                pagePath,
                componentCount: components.length
            });
            return {
                success: true,
                data: analysis,
                metadata: pageContentResponse.metadata
            };
        }
        catch (error) {
            this.logger.error('Failed to scan page components', error, { pagePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while scanning components for ${pagePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, pagePath });
        }
    }
    /**
     * Get all text content from multiple pages
     */
    async getAllTextContent(pagePaths) {
        try {
            this.logger.debug('Getting all text content', { pagePaths });
            if (!pagePaths || pagePaths.length === 0) {
                throw new AEMException('At least one page path is required', 'VALIDATION_ERROR', false);
            }
            const results = [];
            // Process each page sequentially
            for (const pagePath of pagePaths) {
                try {
                    const pageTextResponse = await this.getPageTextContent(pagePath);
                    if (pageTextResponse.success && pageTextResponse.data) {
                        results.push(pageTextResponse.data);
                    }
                }
                catch (error) {
                    this.logger.warn(`Failed to get text content for ${pagePath}`, error);
                    // Continue with other pages even if one fails
                }
            }
            this.logger.debug('Successfully retrieved all text content', {
                pageCount: results.length
            });
            return {
                success: true,
                data: results,
                metadata: {
                    timestamp: new Date(),
                    requestId: '',
                    duration: 0
                }
            };
        }
        catch (error) {
            this.logger.error('Failed to get all text content', error);
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException('Unexpected error while getting all text content', 'UNKNOWN_ERROR', false, undefined, { originalError: error });
        }
    }
    /**
     * Get page-specific text content
     */
    async getPageTextContent(pagePath) {
        try {
            this.logger.debug('Getting page text content', { pagePath });
            if (!pagePath) {
                throw new AEMException('Page path is required', 'VALIDATION_ERROR', false);
            }
            // Get page content with components
            const pageContentResponse = await this.contentDiscoveryService.getPageContent(pagePath);
            if (!pageContentResponse.success || !pageContentResponse.data) {
                throw new AEMException(`Failed to get page content for ${pagePath}`, 'SERVER_ERROR', true, undefined, { response: pageContentResponse });
            }
            const pageContent = pageContentResponse.data;
            const textItems = [];
            // Extract text from all components
            this.extractTextFromComponents(pageContent.components, textItems);
            // Calculate total text length
            const totalTextLength = textItems.reduce((total, item) => total + item.text.length, 0);
            const pageTextContent = {
                pagePath,
                pageTitle: pageContent.title,
                totalTextLength,
                textItems
            };
            this.logger.debug('Successfully retrieved page text content', {
                pagePath,
                textItemCount: textItems.length,
                totalTextLength
            });
            return {
                success: true,
                data: pageTextContent,
                metadata: pageContentResponse.metadata
            };
        }
        catch (error) {
            this.logger.error('Failed to get page text content', error, { pagePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting text content for ${pagePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, pagePath });
        }
    }
    /**
     * Get page images and image references
     */
    async getPageImages(pagePath) {
        try {
            this.logger.debug('Getting page images', { pagePath });
            if (!pagePath) {
                throw new AEMException('Page path is required', 'VALIDATION_ERROR', false);
            }
            // Get page content with components
            const pageContentResponse = await this.contentDiscoveryService.getPageContent(pagePath);
            if (!pageContentResponse.success || !pageContentResponse.data) {
                throw new AEMException(`Failed to get page content for ${pagePath}`, 'SERVER_ERROR', true, undefined, { response: pageContentResponse });
            }
            const pageContent = pageContentResponse.data;
            const images = [];
            // Extract images from all components
            this.extractImagesFromComponents(pageContent.components, images);
            const pageImages = {
                pagePath,
                pageTitle: pageContent.title,
                imageCount: images.length,
                images
            };
            this.logger.debug('Successfully retrieved page images', {
                pagePath,
                imageCount: images.length
            });
            return {
                success: true,
                data: pageImages,
                metadata: pageContentResponse.metadata
            };
        }
        catch (error) {
            this.logger.error('Failed to get page images', error, { pagePath });
            if (error instanceof AEMException) {
                throw error;
            }
            throw new AEMException(`Unexpected error while getting images for ${pagePath}`, 'UNKNOWN_ERROR', false, undefined, { originalError: error, pagePath });
        }
    }
    /**
     * Extract components recursively
     */
    extractComponentsRecursively(components, result) {
        for (const component of components) {
            // Add component to result
            result.push({
                path: component.path,
                resourceType: component.resourceType,
                properties: { ...component.properties }
            });
            // Process child components recursively
            if (component.children && component.children.length > 0) {
                this.extractComponentsRecursively(component.children, result);
            }
        }
    }
    /**
     * Extract text from components
     */
    extractTextFromComponents(components, result) {
        for (const component of components) {
            // Check for text content in this component
            const textContent = this.extractTextFromComponent(component);
            if (textContent) {
                result.push(textContent);
            }
            // Process child components recursively
            if (component.children && component.children.length > 0) {
                this.extractTextFromComponents(component.children, result);
            }
        }
    }
    /**
     * Extract text from a single component
     */
    extractTextFromComponent(component) {
        const props = component.properties;
        let text = '';
        let context = '';
        // Check for common text properties based on resource type
        if (component.resourceType.includes('/text')) {
            // Text component
            if (props.text) {
                text = this.stripHtml(props.text);
            }
        }
        else if (component.resourceType.includes('/title')) {
            // Title component
            if (props.jcr_title || props.title) {
                text = props.jcr_title || props.title;
            }
        }
        else if (component.resourceType.includes('/heading')) {
            // Heading component
            if (props.heading || props.text || props.title) {
                text = props.heading || props.text || props.title;
            }
        }
        else if (component.resourceType.includes('/teaser')) {
            // Teaser component
            if (props.title) {
                text = props.title;
                if (props.description) {
                    text += ' ' + props.description;
                }
            }
        }
        else if (component.resourceType.includes('/button')) {
            // Button component
            if (props.text || props.label) {
                text = props.text || props.label;
            }
        }
        else {
            // Generic check for text properties
            for (const key of ['text', 'title', 'description', 'content', 'value']) {
                if (props[key] && typeof props[key] === 'string') {
                    text = props[key];
                    context = key;
                    break;
                }
            }
        }
        // Return text content if found
        if (text) {
            return {
                path: component.path,
                text,
                resourceType: component.resourceType,
                context: context || undefined
            };
        }
        return null;
    }
    /**
     * Extract images from components
     */
    extractImagesFromComponents(components, result) {
        for (const component of components) {
            // Check for image content in this component
            const imageRef = this.extractImageFromComponent(component);
            if (imageRef) {
                result.push(imageRef);
            }
            // Process child components recursively
            if (component.children && component.children.length > 0) {
                this.extractImagesFromComponents(component.children, result);
            }
        }
    }
    /**
     * Extract image from a single component
     */
    extractImageFromComponent(component) {
        const props = component.properties;
        // Check if this is an image component
        if (component.resourceType.includes('/image') ||
            component.resourceType.includes('/teaser') ||
            component.resourceType.includes('/banner')) {
            // Look for file reference
            const fileReference = props.fileReference || props.fileReferenceParameter || props.asset;
            if (fileReference || props.file) {
                return {
                    path: component.path,
                    resourceType: component.resourceType,
                    fileReference: fileReference || props.file,
                    alt: props.alt || props.altText || props.alternateText,
                    title: props.title || props.imageTitle,
                    width: props.width ? parseInt(props.width) : undefined,
                    height: props.height ? parseInt(props.height) : undefined,
                    renditions: this.extractRenditions(props)
                };
            }
        }
        // Check for background image
        if (props.backgroundImage || props.bgImage) {
            return {
                path: component.path,
                resourceType: component.resourceType,
                fileReference: props.backgroundImage || props.bgImage,
                alt: props.alt || props.altText,
                title: props.title
            };
        }
        return null;
    }
    /**
     * Extract renditions from component properties
     */
    extractRenditions(props) {
        const renditions = [];
        // Check for renditions property
        if (props.renditions && Array.isArray(props.renditions)) {
            for (const rendition of props.renditions) {
                if (typeof rendition === 'string') {
                    renditions.push(rendition);
                }
                else if (rendition.path) {
                    renditions.push(rendition.path);
                }
            }
        }
        // Check for specific rendition properties
        for (const key of Object.keys(props)) {
            if (key.includes('rendition') &&
                typeof props[key] === 'string' &&
                props[key].startsWith('/content/dam/')) {
                renditions.push(props[key]);
            }
        }
        return renditions.length > 0 ? renditions : undefined;
    }
    /**
     * Strip HTML tags from text
     */
    stripHtml(html) {
        // Simple HTML tag removal
        return html
            .replace(/<[^>]*>/g, ' ') // Replace tags with space
            .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim(); // Trim leading/trailing whitespace
    }
}
//# sourceMappingURL=component-analysis-service.js.map