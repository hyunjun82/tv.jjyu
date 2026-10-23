'use client';
import { useEffect, useState } from 'react';
// 이동 페이지: 3초 뒤 자동으로 공식 서비스로 넘어간다. 버튼을 누르면 바로 간다.
export default function Go({ url }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    if (n <= 0) { window.location.href = url; return; }
    const t = setTimeout(() => setN(n - 1), 1000);
    return () => clearTimeout(t);
  }, [n, url]);
  return <span className="num">{n}초 뒤 자동 이동</span>;
}
