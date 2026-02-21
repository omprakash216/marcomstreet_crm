/**
 * Simple Client-Side Cache for Fast Loading
 * React UI में fast loading के लिए caching
 */

class ClientCache {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  /**
   * Get cached data
   */
  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.value;
  }

  /**
   * Set cache data
   */
  set(key, value, ttl = null) {
    const expires = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expires });
  }

  /**
   * Delete cache
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Generate cache key from URL and params
   */
  static generateKey(url, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${url}?${sortedParams}`;
  }
}

// Export singleton instance
export const clientCache = new ClientCache();

// Cache interceptor for axios
export const cacheInterceptor = (config) => {
  // Only cache GET requests (NOT POST, PUT, DELETE)
  // Never cache auth endpoints (login, logout)
  const isAuthEndpoint = config.url?.includes('/auth/login') || 
                         config.url?.includes('/auth/logout') ||
                         config.url?.includes('/auth/verify');
  
  if (config.method === 'get' && !isAuthEndpoint) {
    const cacheKey = ClientCache.generateKey(config.url, config.params);
    const cached = clientCache.get(cacheKey);
    
    if (cached) {
      // Return cached data immediately
      return Promise.resolve({
        data: cached,
        status: 200,
        statusText: 'OK',
        headers: { 'X-Cache': 'HIT' },
        config,
        isCached: true
      });
    }
  }
  
  return config;
};

// Response interceptor to cache responses
export const cacheResponseInterceptor = (response) => {
  // Only cache GET requests (NOT POST, PUT, DELETE)
  // Never cache auth endpoints (login, logout)
  const isAuthEndpoint = response.config?.url?.includes('/auth/login') || 
                         response.config?.url?.includes('/auth/logout') ||
                         response.config?.url?.includes('/auth/verify');
  
  if (response.config.method === 'get' && !isAuthEndpoint && response.status === 200) {
    const cacheKey = ClientCache.generateKey(response.config.url, response.config.params);
    
    // Cache for shorter time if server says it's cached
    const ttl = response.headers['x-cache'] === 'HIT' ? 2 * 60 * 1000 : 5 * 60 * 1000;
    clientCache.set(cacheKey, response.data, ttl);
  }
  
  return response;
};

