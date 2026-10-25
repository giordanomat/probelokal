import sys, subprocess, numpy as np, xml.etree.ElementTree as ET
base=sys.argv[1]
OFF=6.237; SPB=60/115
SHIFT={'trp1':-2,'trp2':-2,'pos1':-14,'pos2':-14,'euph':-14,'sous':-26}
PART={'trp1':0,'trp2':1,'pos1':2,'pos2':3,'euph':4,'sous':5}
RANGE={'trp':(140,1100),'pos':(60,600),'euph':(60,600),'sous':(35,300)}
r=ET.parse(base+'/badtouch.xml').getroot()
def notes(pi):
    p=r.findall('part')[pi]; div=1; out=[]; last=None
    for m in p.findall('measure'):
        beat=int(m.get('number'))*4
        for e in m:
            if e.tag=='attributes' and e.find('divisions') is not None: div=int(e.findtext('divisions'))
            if e.tag=='note':
                d=int(e.findtext('duration'))/div; pt=e.find('pitch')
                if pt is not None:
                    mi=12*(int(pt.findtext('octave'))+1)+{'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[pt.findtext('step')]+int(float(pt.findtext('alter') or 0))
                    stop=any(t.get('type')=='stop' for t in e.findall('tie'))
                    if stop and last and last[2]==mi and abs(last[0]+last[1]-beat)<1e-6: last[1]+=d
                    else: last=[beat,d,mi]; out.append(last)
                else: last=None
                beat+=d
    return out
def yin(seg,sr,fmin,fmax,th=0.15):
    W=len(seg)//2; tmin=int(sr/fmax); tmax=min(int(sr/fmin),W-1)
    x=seg.astype(np.float64)
    # difference via FFT-ish brute force (vectorised)
    d=np.zeros(tmax+1)
    for t in range(1,tmax+1):
        dd=x[:W]-x[t:t+W]; d[t]=np.dot(dd,dd)
    cm=np.ones_like(d); cs=np.cumsum(d[1:]); cm[1:]=d[1:]*np.arange(1,tmax+1)/np.maximum(cs,1e-12)
    for t in range(max(tmin,2),tmax):
        if cm[t]<th:
            while t+1<tmax and cm[t+1]<cm[t]: t+=1
            a,b,c=cm[t-1],cm[t],cm[t+1]; den=a-2*b+c; sh=0.5*(a-c)/den if den else 0
            return sr/(t+sh), cm[t]
    return None, None
for v in sys.argv[2:]:
    sr=22050
    raw=subprocess.run(['ffmpeg','-v','error','-i',f'{base}/stems/{v}.mp3','-ac','1','-ar',str(sr),'-f','f32le','-'],capture_output=True).stdout
    x=np.frombuffer(raw,dtype=np.float32)
    fmin,fmax=RANGE[v[:4] if v.startswith('euph') else v[:3] if v[:3] in('trp','pos') else v[:4]]
    N=2048 if fmin>=60 else 4096
    res={'hit':0,'near':0,'wrong':0,'none':0}; tot=0
    for b,d,mi in notes(PART[v]):
        t0=OFF+b*SPB; t1=t0+d*SPB; w0=t0+min(0.06,d*SPB*0.3); w1=t1-min(0.04,d*SPB*0.2)
        exp=mi+SHIFT[v]; fr=[]
        t=w0
        while t+N/sr<=w1+N/sr*0.5:
            i=int(t*sr); seg=x[i:i+N]
            if len(seg)==N and np.sqrt(np.mean(seg**2))>0.01:
                f,c=yin(seg,sr,fmin,fmax)
                if f: fr.append(69+12*np.log2(f/440)-exp)
            t+=0.016
        tot+=1
        if not fr: res['none']+=1; continue
        fr=np.array(fr); hit=np.mean(np.abs(fr)<=0.5)
        if hit>=0.5: res['hit']+=1
        elif np.mean(np.abs(fr)<=1)>=0.5: res['near']+=1
        else: res['wrong']+=1
    print(v,tot,{k:f'{n} ({n/tot:.0%})' for k,n in res.items()},flush=True)
