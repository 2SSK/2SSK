const { Octokit } = require('@octokit/rest');
const fs = require('fs');

const username = process.env.USERNAME || '2SSK';
const token = process.env.GITHUB_TOKEN;

const octokit = token
  ? new Octokit({ auth: token, userAgent: 'GitHub-Readme-Update' })
  : new Octokit({ userAgent: 'GitHub-Readme-Update' });

/**
 * Calculate a score for repository quality/seriousness
 * @param {Object} repo - Repository object from GitHub API
 * @returns {number} - Calculated score
 */
function calculateRepoScore(repo) {
  let score = 0;
  
  // Base score for public repos
  if (!repo.private) score += 10;
  
  // Community validation (stars and forks)
  score += (repo.stargazers_count || 0) * 5;
  score += (repo.forks_count || 0) * 3;
  
  // Codebase size (max 50 points)
  score += Math.min(repo.size || 0, 50);
  
  // Documentation and metadata
  if (repo.description) score += 5;
  if (repo.topics && repo.topics.length > 0) score += 3;
  if (repo.license) score += 2;
  if (repo.has_wiki || repo.description) score += 3;
  
  // Maintenance status
  if (!repo.archived) score += 5;
  
  // Recent activity (within last 6 months)
  if (repo.updated_at) {
    const updatedAt = new Date(repo.updated_at);
    const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 180) score += 10;
  }
  
  return score;
}

/**
 * Update README with repository statistics
 */
async function updateReadme() {
  try {
    console.log(`🔍 Fetching repositories for user: ${username}`);
    
    // Fetch repositories from GitHub API
    const { data: repos } = await octokit.repos.listForUser({
      username,
      per_page: 100,
      sort: 'updated'
    });
    
    // Validate API response
    if (!repos || !Array.isArray(repos)) {
      throw new Error('Invalid response from GitHub API');
    }
    
    console.log(`📊 Found ${repos.length} total repositories`);
    
    // Filter public repos and calculate scores
    const publicRepos = repos
      .filter(repo => !repo.private)
      .map(repo => ({ ...repo, score: calculateRepoScore(repo) }));
    
    console.log(`🌐 Found ${publicRepos.length} public repositories`);
    
    // Validate we have public repos
    if (publicRepos.length === 0) {
      console.log('⚠️  No public repositories found. README will not be updated.');
      return;
    }
    
    // Sort by score, then by stars, then by forks, then by last updated
    publicRepos.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.stargazers_count || 0) !== (a.stargazers_count || 0)) return (b.stargazers_count || 0) - (a.stargazers_count || 0);
      if ((b.forks_count || 0) !== (a.forks_count || 0)) return (b.forks_count || 0) - (a.forks_count || 0);
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });
    
    // Take top 15 repos
    const topRepos = publicRepos.slice(0, 15);
    
    // Generate table rows
    const tableRows = topRepos.map(repo => {
      const name = repo.name;
      let description = repo.description || 'No description';
      if (description.length > 100) {
        description = description.substring(0, 97) + '...';
      }
      
      const language = repo.language || 'N/A';
      const stars = repo.stargazers_count || 0;
      const forks = repo.forks_count || 0;
      const updatedAt = repo.updated_at ? new Date(repo.updated_at).toISOString().split('T')[0] : 'N/A';
      
      return `| [${name}](https://github.com/${username}/${name}) | ${description} | ${language} | ${stars} | ${forks} | ${updatedAt} |`;
    });
    
    // Read and update README
    const readmePath = 'README.md';
    if (!fs.existsSync(readmePath)) {
      throw new Error('README.md file not found');
    }
    
    let content = fs.readFileSync(readmePath, 'utf8');
    
    // Find the table section
    const tableStart = content.indexOf('| Repository | Description | Primary Language | Stars | Forks | Last Updated |');
    if (tableStart === -1) {
      throw new Error('Table header not found in README.md. Expected: "| Repository | Description | Primary Language | Stars | Forks | Last Updated |"');
    }
    
    let tableEnd = content.indexOf('\n\n', tableStart);
    if (tableEnd === -1) {
      tableEnd = content.length;
    }
    
    // Create new table content
    const newTable = `| Repository | Description | Primary Language | Stars | Forks | Last Updated |
| ---------- | ----------- | ---------------- | ----- | ----- | ------------ |
${tableRows.join('\n')}`;
    
    // Replace the table in README
    const newContent = content.substring(0, tableStart) + newTable + content.substring(tableEnd);
    
    // Write back to README
    fs.writeFileSync(readmePath, newContent);
    
    console.log(`✅ Successfully updated README with ${tableRows.length} repositories`);
    console.log('🏆 Top 5 repositories by score:');
    topRepos.slice(0, 5).forEach((repo, i) => {
      console.log(`  ${i + 1}. ${repo.name} (Score: ${repo.score}, Stars: ${repo.stargazers_count || 0})`);
    });
    
  } catch (error) {
    console.error('❌ Error updating README:', error.message);
    if (error.status) {
      console.error(`GitHub API Status: ${error.status}`);
    }
    if (error.response) {
      console.error(`GitHub API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    process.exit(1);
  }
}

// Run the update
updateReadme();
