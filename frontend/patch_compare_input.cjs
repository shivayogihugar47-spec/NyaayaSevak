const fs = require('fs');

const appPath = 'src/App.jsx';
let code = fs.readFileSync(appPath, 'utf8');

// 1. Add fileA and fileB state variables
code = code.replace(
  /const \[textA, setTextA\] = useState\(''\);\n\s*const \[textB, setTextB\] = useState\(''\);/,
  `const [fileA, setFileA] = useState(null);\n  const [fileB, setFileB] = useState(null);`
);

// 2. Replace handleCompare
const oldHandleCompareRegex = /const handleCompare = async \(e\) => \{[\s\S]*?\};\n/;
const newHandleCompare = `const handleCompare = async (e) => {
    e.preventDefault();
    if (!fileA || !fileB) return;
    setProcessing(true);
    
    const formData = new FormData();
    formData.append('fileA', fileA);
    formData.append('fileB', fileB);

    try {
      const res = await axios.post('/api/compare', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCompareResults(res.data.analysis);
    } catch (err) {
      alert("Failed to compare documents. " + (err.response?.data?.error || ""));
    } finally {
      setProcessing(false);
    }
  };\n`;
code = code.replace(oldHandleCompareRegex, newHandleCompare);

// 3. Replace the Compare UI inside the main render block
const compareUIRegex = /<div className="glass-panel rounded-2xl p-8 shadow-2xl">\s*<form onSubmit=\{handleCompare\} className="flex flex-col gap-6">[\s\S]*?<\/form>\s*<\/div>/;

const newCompareUI = `<div className="bg-[#111113] border border-neutral-800 rounded-2xl p-8 shadow-2xl max-w-4xl mx-auto">
                  <form onSubmit={handleCompare} className="flex flex-col gap-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Original Version Dropzone */}
                      <div>
                        <label className="block text-sm font-semibold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-red-500"></span> Original Draft
                        </label>
                        <div className={\`border-2 border-dashed rounded-xl p-10 text-center transition-colors relative \${fileA ? 'border-red-500/50 bg-red-500/5' : 'border-neutral-700 bg-black/40 hover:bg-neutral-900/50'}\`}>
                          <input 
                            type="file" 
                            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => setFileA(e.target.files[0])}
                          />
                          <UploadCloud className={\`w-10 h-10 mx-auto mb-3 \${fileA ? 'text-red-400' : 'text-neutral-500'}\`} />
                          <div className="text-sm font-medium text-white mb-1">
                            {fileA ? fileA.name : "Upload Original (V1)"}
                          </div>
                          <div className="text-xs text-neutral-500">PDF, Image, or Word Document</div>
                        </div>
                      </div>

                      {/* New Version Dropzone */}
                      <div>
                        <label className="block text-sm font-semibold text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                           <span className="w-2 h-2 rounded-full bg-green-500"></span> Proposed Draft
                        </label>
                        <div className={\`border-2 border-dashed rounded-xl p-10 text-center transition-colors relative \${fileB ? 'border-green-500/50 bg-green-500/5' : 'border-neutral-700 bg-black/40 hover:bg-neutral-900/50'}\`}>
                          <input 
                            type="file" 
                            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => setFileB(e.target.files[0])}
                          />
                          <UploadCloud className={\`w-10 h-10 mx-auto mb-3 \${fileB ? 'text-green-400' : 'text-neutral-500'}\`} />
                          <div className="text-sm font-medium text-white mb-1">
                            {fileB ? fileB.name : "Upload Proposed (V2)"}
                          </div>
                          <div className="text-xs text-neutral-500">PDF, Image, or Word Document</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center pt-4 border-t border-neutral-800">
                      <button 
                        type="submit"
                        disabled={processing || !fileA || !fileB}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-3.5 rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_30px_rgba(79,70,229,0.2)] hover:shadow-[0_0_40px_rgba(79,70,229,0.4)]"
                      >
                        {processing ? "Running X-Ray Analysis..." : "Compare & Find Risks"}
                        {!processing && <ArrowLeftRight className="w-5 h-5" />}
                      </button>
                    </div>
                  </form>
                </div>`;

code = code.replace(compareUIRegex, newCompareUI);
fs.writeFileSync(appPath, code);
console.log('Compare UI patched successfully.');
