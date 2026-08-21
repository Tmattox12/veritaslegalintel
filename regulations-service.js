/**
 * Veritas Regulations Service
 * Fetches and caches regulations, guidance, and case law for AFI using ScaleSerp
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '.regulations-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'afi-regulations.json');
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Search regulations using ScaleSerp API
 */
async function searchRegulations(query, apiKey) {
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      q: query,
      num: 10
    });

    const url = `https://api.scaleserp.com/search?${params}`;
    console.log(`Making API request to: ${url}`);

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('ScaleSerp error response:', data);
      throw new Error(`ScaleSerp API error: ${response.statusText}`);
    }

    console.log(`Got results for "${query}": ${data.organic_results?.length || 0} items`);
    return data.organic_results || [];
  } catch (error) {
    console.error(`Search error for "${query}":`, error.message);
    return [];
  }
}

/**
 * Fetch AFI regulations and guidance
 */
async function fetchAFIRegulations(apiKey) {
  const searches = [
    {
      query: 'Arizona AFI Affidavit Financial Information expense classifications',
      category: 'Regulations'
    },
    {
      query: 'Arizona family law necessary versus discretionary expenses definition',
      category: 'Guidance'
    },
    {
      query: 'Arizona AFI case law recent decisions 2024 2025 2026',
      category: 'Cases'
    },
    {
      query: 'Arizona Supreme Court AFI financial disclosure requirements',
      category: 'Court Rules'
    },
    {
      query: 'Arizona family law expense reconciliation best practices',
      category: 'Best Practices'
    }
  ];

  const results = {
    timestamp: new Date(),
    regulations: [],
    guidance: [],
    cases: [],
    courtRules: [],
    bestPractices: [],
    lastUpdated: new Date().toISOString()
  };

  for (const search of searches) {
    console.log(`Fetching ${search.category}: ${search.query}`);
    const searchResults = await searchRegulations(search.query, apiKey);

    const formattedResults = searchResults.slice(0, 5).map(result => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      source: result.source,
      date: result.date || 'N/A'
    }));

    switch (search.category) {
      case 'Regulations':
        results.regulations = formattedResults;
        break;
      case 'Guidance':
        results.guidance = formattedResults;
        break;
      case 'Cases':
        results.cases = formattedResults;
        break;
      case 'Court Rules':
        results.courtRules = formattedResults;
        break;
      case 'Best Practices':
        results.bestPractices = formattedResults;
        break;
    }
  }

  return results;
}

/**
 * Get cached regulations or fetch new ones
 */
async function getAFIRegulations(apiKey) {
  try {
    // Check if cache exists and is still valid
    if (fs.existsSync(CACHE_FILE)) {
      const fileStats = fs.statSync(CACHE_FILE);
      const fileAge = Date.now() - fileStats.mtime.getTime();

      if (fileAge < CACHE_EXPIRY) {
        console.log('Using cached regulations');
        const cached = fs.readFileSync(CACHE_FILE, 'utf8');
        return JSON.parse(cached);
      }
    }

    // Fetch new regulations
    console.log('Fetching fresh regulations from ScaleSerp');
    const regulations = await fetchAFIRegulations(apiKey);

    // Cache the results
    fs.writeFileSync(CACHE_FILE, JSON.stringify(regulations, null, 2));

    return regulations;
  } catch (error) {
    console.error('Error getting AFI regulations:', error);

    // Return cached data if available, even if expired
    if (fs.existsSync(CACHE_FILE)) {
      const cached = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(cached);
    }

    // Return empty result if no cache available
    return {
      timestamp: new Date(),
      regulations: [],
      guidance: [],
      cases: [],
      courtRules: [],
      bestPractices: [],
      lastUpdated: new Date().toISOString(),
      error: 'Unable to fetch regulations. Check API key.'
    };
  }
}

/**
 * Format regulations for display in frontend
 */
function formatRegulationsForDisplay(regulationsData) {
  return {
    regulations: {
      title: 'Arizona AFI Regulations',
      items: regulationsData.regulations.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: item.source
      }))
    },
    guidance: {
      title: 'Necessary vs Discretionary Spending Guidance',
      items: regulationsData.guidance.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: item.source
      }))
    },
    cases: {
      title: 'Recent AFI Case Law',
      items: regulationsData.cases.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: item.source,
        date: item.date
      }))
    },
    courtRules: {
      title: 'Court Rules & Requirements',
      items: regulationsData.courtRules.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: item.source
      }))
    },
    bestPractices: {
      title: 'Best Practices',
      items: regulationsData.bestPractices.map(item => ({
        title: item.title,
        url: item.url,
        snippet: item.snippet,
        source: item.source
      }))
    },
    lastUpdated: regulationsData.lastUpdated
  };
}

module.exports = {
  getAFIRegulations,
  formatRegulationsForDisplay,
  CACHE_EXPIRY
};
