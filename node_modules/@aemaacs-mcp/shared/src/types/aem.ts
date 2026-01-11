/**
 * Core AEMaaCS types and interfaces
 */

export interface AEMResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AEMError;
  metadata?: ResponseMetadata;
}

export interface AEMError {
  code: string;
  message: string;
  details?: Record<string, any> | undefined;
  recoverable: boolean;
  retryAfter?: number | undefined;
}

export interface ResponseMetadata {
  timestamp: Date;
  requestId: string;
  duration: number;
  cached?: boolean;
  statusCode?: number;
  responseTime?: number;
}

export interface AEMCredentials {
  type: 'basic' | 'oauth' | 'service-account' | 'token';
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  privateKey?: string;
  accessToken?: string;
  cookies?: string; // Full cookie string for browser session tokens (AEMaaCS)
}

export interface AEMConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  basePath?: string;
  timeout: number;
  retryAttempts: number;
  authentication: AEMCredentials;
}

export interface ContentNode {
  path: string;
  name: string;
  primaryType: string;
  title?: string;
  lastModified?: Date;
  properties: Record<string, any>;
  children?: ContentNode[];
}

export interface Page extends ContentNode {
  template: string;
  resourceType: string;
  published: boolean;
  lastReplicated?: Date;
}

export interface Asset extends ContentNode {
  mimeType: string;
  size: number;
  metadata: AssetMetadata;
  renditions: Rendition[];
}

export interface AssetMetadata {
  width?: number;
  height?: number;
  format?: string;
  colorSpace?: string;
  [key: string]: any;
}

export interface Rendition {
  name: string;
  path: string;
  width?: number;
  height?: number;
  size: number;
  mimeType: string;
}

export interface Package {
  name: string;
  group: string;
  version: string;
  path: string;
  size: number;
  created: Date;
  lastModified: Date;
  installed: boolean;
  builtWith?: string;
}

export interface User {
  id: string;
  path: string;
  profile: UserProfile;
  groups: string[];
  permissions: Permission[];
}

export interface UserProfile {
  givenName?: string;
  familyName?: string;
  email?: string;
  title?: string;
  [key: string]: any;
}

export interface Group {
  id: string;
  path: string;
  title?: string;
  description?: string;
  members: string[];
}

export interface Permission {
  path: string;
  privileges: string[];
  allow: boolean;
}

export interface WorkflowInstance {
  id: string;
  modelPath: string;
  payloadPath: string;
  state: 'RUNNING' | 'COMPLETED' | 'ABORTED' | 'SUSPENDED';
  startTime: Date;
  endTime?: Date;
  initiator: string;
}

export interface Tag {
  id: string;
  path: string;
  title: string;
  description?: string;
  namespace: string;
  parentPath?: string;
  children?: Tag[];
}

export enum ErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface OperationContext {
  requestId: string;
  userId?: string;
  operation: string;
  resource: string;
  timestamp: Date;
}