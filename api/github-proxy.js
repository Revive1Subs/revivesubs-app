// api/github-proxy.js - نسخة محسّنة للتعامل مع الملفات الكبيرة

async function apiRequest(url, method = 'GET', body = null, pat) {
  const headers = {
    'Authorization': `token ${pat}`, 'Accept': 'application/vnd.github.v3+json',
  };
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(`GitHub API Error: ${response.status} ${errorData.message || ''}`);
  }
  if (response.status === 204 || response.status === 201) return {};
  return response.json();
}

export default async function handler(req, res) {
  const GITHUB_USERNAME = 'Revive1Subs';
  const REPO_NAME = 'revivesubs-data';
  const FILE_PATH = 'data.json';
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GIT_BRANCH = 'main'; 
  const API_BASE = 'https://api.github.com';
  if (!GITHUB_PAT) {
    console.error("CRITICAL: GITHUB_PAT environment variable is not set.");
    return res.status(500).json({ error: "خطأ في الإعدادات: المفتاح السري (GITHUB_PAT) غير موجود في الخادم." });
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader( 'Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (req.method === 'GET') {
    try {
      const contentsUrl = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${FILE_PATH}?ref=${GIT_BRANCH}`;
      const fileMeta = await apiRequest(contentsUrl, 'GET', null, GITHUB_PAT).catch(e => {
        if (e.message.includes('404')) return null; throw e;
      });

      if (!fileMeta || !fileMeta.sha) return res.status(404).json({ message: "الملف غير موجود في المستودع." });

      const blobUrl = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/blobs/${fileMeta.sha}`;
      const blobData = await apiRequest(blobUrl, 'GET', null, GITHUB_PAT);
      
      if(!blobData.content) return res.status(200).json({ content: null, message: "الملف موجود لكنه فارغ." });
      
      res.status(200).json({ content: blobData.content, sha: fileMeta.sha });
    } catch (error) { res.status(500).json({ error: error.message }); }
  } 
  else if (req.method === 'POST') {
    try {
      const { content, sha: clientSha } = req.body;
      const refUrl = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/refs/heads/${GIT_BRANCH}`;
      
      const blobData = await apiRequest(`${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/blobs`, 'POST', { content, encoding: 'base64' }, GITHUB_PAT);
      const newBlobSha = blobData.sha;
      
      const refData = await apiRequest(refUrl, 'GET', null, GITHUB_PAT);
      const latestCommitSha = refData.object.sha;
      
      const treeData = await apiRequest(`${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/trees`, 'POST', {
        base_tree: latestCommitSha,
        tree: [{ path: FILE_PATH, mode: '100644', type: 'blob', sha: newBlobSha }]
      }, GITHUB_PAT);
      const newTreeSha = treeData.sha;
      
      const newCommitData = await apiRequest(`${API_BASE}/repos/${GITHUB_USERNAME}/${REPO_NAME}/git/commits`, 'POST', {
        message: `Data update: ${new Date().toISOString()}`,
        tree: newTreeSha,
        parents: [latestCommitSha]
      }, GITHUB_PAT);
      const newCommitSha = newCommitData.sha;
      
      await apiRequest(refUrl, 'PATCH', { sha: newCommitSha }, GITHUB_PAT);
      
      res.status(200).json({ message: "تم التحديث بنجاح." });
    } catch (error) { res.status(500).json({ error: error.message }); }
  } 
  else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
