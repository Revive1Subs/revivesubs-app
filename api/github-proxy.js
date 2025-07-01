async function apiRequest(url, method = 'GET', body = null, pat) {
  const headers = {
    'Authorization': `token ${pat}`,
    'Accept': 'application/vnd.github.v3+json',
  };
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`GitHub API Error: ${response.status} ${errorData.message || ''}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GITHUB_USERNAME = 'Revive1Subs';
  const REPO_NAME = 'revivesubs-data';
  const FILE_PATH = 'data.json';
  const API_BASE = 'https://api.github.com';
  const GIT_BRANCH = 'main';

  if (!GITHUB_PAT) {
    return res.status(500).json({ error: 'GITHUB_PAT is missing in environment.' });
  }

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const url = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}?ref=${GIT_BRANCH}`;
      const fileMeta = await apiRequest(url, 'GET', null, GITHUB_PAT);
      res.status(200).json({
        content: fileMeta.content,
        sha: fileMeta.sha,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  else if (req.method === 'POST') {
    try {
      const { content, sha } = req.body;
      const url = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}`;

      const result = await apiRequest(url, 'PUT', {
        message: `Data update: ${new Date().toISOString()}`,
        content,  // base64
        sha,      // optional: if you want to ensure you're updating the latest version
        branch: GIT_BRANCH
      }, GITHUB_PAT);

      res.status(200).json({
        message: 'تم التحديث بنجاح',
        commit: result.commit.sha,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
