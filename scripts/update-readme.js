const { Octokit } = require('@octokit/rest');
const fs = require('fs');

const username = process.env.GITHUB_USERNAME || '2SSK';
const token = process.env.GITHUB_TOKEN;
const featuredTopic = process.env.FEATURED_TOPIC || 'featured';

const octokit = token
  ? new Octokit({
      auth: token,
      userAgent: 'GitHub-Readme-Update',
      request: { headers: { accept: 'application/vnd.github.mercy-preview+json' } }
    })
  : new Octokit({
      userAgent: 'GitHub-Readme-Update',
      request: { headers: { accept: 'application/vnd.github.mercy-preview+json' } }
    });

/**
 * Calculate a score for repository quality/seriousness
 * @param {Object} repo - Repository object from GitHub API
 * @returns {number} - Calculated score
 */
function calculateRepoScore(repo) {
  let score = 0;
  if (!repo.private) score += 10;
  score += (repo.stargazers_count || 0) * 5;
  score += (repo.forks_count || 0) * 3;
  score += Math.min(repo.size || 0, 50);
  if (repo.description) score += 5;
  if (repo.topics && repo.topics.length > 0) score += 3;
  if (repo.license) score += 2;
  if (repo.has_wiki || repo.description) score += 3;
  if (!repo.archived) score += 5;
  if (repo.updated_at) {
    const updatedAt = new Date(repo.updated_at);
    const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 180) score += 10;
  }
  return score;
}

/**
 * Returns a human-friendly "X days ago" string with a tooltip for the full date
 */
function timeAgoWithTooltip(dateString) {
  if (!dateString) return 'N/A';
  const now = new Date();
  const updated = new Date(dateString);
  const diff = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
  let display = '';
  if (diff < 1) display = 'Today';
  else if (diff === 1) display = '1 day ago';
  else if (diff < 30) display = `${diff} days ago`;
  else {
    const months = Math.floor(diff / 30);
    display = months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const fullDate = updated.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  return `<span title="${fullDate}">${display}</span>`;
}

/**
 * Update README with repository statistics
 */
async function updateReadme() {
  try {
    console.log(`🔍 Fetching repositories for user: ${username}`);
    console.log(`⭐ Looking for repositories with topic: "${featuredTopic}"`);
    const { data: repos } = await octokit.repos.listForUser({
      username,
      per_page: 100,
      sort: 'updated'
    });
    if (!repos || !Array.isArray(repos)) throw new Error('Invalid response from GitHub API');
    console.log(`📊 Found ${repos.length} total repositories`);
    const featuredRepos = repos
      .filter(repo => !repo.private && repo.topics && repo.topics.includes(featuredTopic))
      .map(repo => ({ ...repo, score: calculateRepoScore(repo) }));
    console.log(`⭐ Found ${featuredRepos.length} repositories with topic "${featuredTopic}"`);
    if (featuredRepos.length === 0) {
      console.log(`⚠️  No repositories found with topic "${featuredTopic}". README will not be updated.`);
      console.log('💡 To add repositories to your README:');
      console.log('   1. Go to your repository on GitHub');
      console.log('   2. Click Settings → Topics');
      console.log(`   3. Add the topic "${featuredTopic}"`);
      return;
    }
    featuredRepos.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.stargazers_count || 0) !== (a.stargazers_count || 0)) return (b.stargazers_count || 0) - (a.stargazers_count || 0);
      if ((b.forks_count || 0) !== (a.forks_count || 0)) return (b.forks_count || 0) - (a.forks_count || 0);
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });
    const topRepos = featuredRepos.slice(0, 15);
    const tableRows = topRepos.map(repo => {
      const name = repo.name;
      let description = repo.description || 'No description';
      if (description.length > 100) description = description.substring(0, 97) + '...';
      const language = repo.language || 'N/A';
      const stars = repo.stargazers_count || 0;
      const forks = repo.forks_count || 0;
      const updatedAt = repo.updated_at ? timeAgoWithTooltip(repo.updated_at) : 'N/A';
      return `| [${name}](https://github.com/${username}/${name}) | ${description} | ${language} | ${stars} | ${forks} | ${updatedAt} |`;
    });
    const readmePath = 'README.md';
    if (!fs.existsSync(readmePath)) throw new Error('README.md file not found');
    let content = fs.readFileSync(readmePath, 'utf8');
    const tableStart = content.search(/\| Repository.*\| Description.*\| Primary Language.*\| Stars.*\| Forks.*\| Last Updated.*\|/);
    if (tableStart === -1) throw new Error('Table header not found in README.md. Expected table with columns: Repository, Description, Primary Language, Stars, Forks, Last Updated');
    let tableEnd = content.indexOf('\n\n', tableStart);
    if (tableEnd === -1) tableEnd = content.length;
    const newTable = `| Repository                                                             | Description                                                                                          | Primary Language | Stars | Forks | Last Updated                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------- | ----- | ----- | ---------------------------------------------- |
${tableRows.join('\n')}`;
    const newContent = content.substring(0, tableStart) + newTable + content.substring(tableEnd);
    fs.writeFileSync(readmePath, newContent);
    console.log(`✅ Successfully updated README with ${tableRows.length} featured repositories`);
    console.log('🏆 Top repositories by score:');
    topRepos.slice(0, 5).forEach((repo, i) => {
      console.log(`  ${i + 1}. ${repo.name} (Score: ${repo.score}, Stars: ${repo.stargazers_count || 0})`);
    });
  } catch (error) {
    console.error('❌ Error updating README:', error.message);
    if (error.status) console.error(`GitHub API Status: ${error.status}`);
    if (error.response) console.error(`GitHub API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    process.exit(1);
  }
}

// Run the update
updateReadme();
