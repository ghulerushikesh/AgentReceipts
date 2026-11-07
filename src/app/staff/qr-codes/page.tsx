"use client";

import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Table } from "@/types/database";
import {
  Printer,
  ArrowLeft,
  QrCode,
  Copy,
  Check,
} from "lucide-react";

export default function QRCodesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Get base URL for QR codes
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    async function fetchTables() {
      try {
        const res = await fetch("/api/tables");
        const data = await res.json();
        const tableList = data.tables || data;
        setTables(Array.isArray(tableList) ? tableList : []);
      } catch {
        console.error("Failed to fetch tables");
      } finally {
        setLoading(false);
      }
    }
    fetchTables();
  }, []);

  function getCheckInUrl(tableId: string) {
    return `${baseUrl}/checkin/${tableId}`;
  }

  function copyUrl(tableId: string) {
    const url = getCheckInUrl(tableId);
    navigator.clipboard.writeText(url);
    setCopied(tableId);
    setTimeout(() => setCopied(null), 2000);
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E0C] flex items-center justify-center">
        <div className="text-center">
          <QrCode className="w-8 h-8 text-[#D7BC83] animate-pulse mx-auto mb-3" />
          <p className="text-[#A7AEA6] text-sm">Loading tables…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print Stylesheet */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 24px !important;
            padding: 20px !important;
          }
          .qr-card-print {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border: 2px solid #111 !important;
            border-radius: 12px !important;
            padding: 24px !important;
            text-align: center !important;
            background: white !important;
          }
          .qr-card-print h3 {
            color: black !important;
            font-size: 16px !important;
            margin: 12px 0 4px !important;
          }
          .qr-card-print p {
            color: #555 !important;
            font-size: 11px !important;
          }
          .qr-card-print .club-name-print {
            font-size: 10px !important;
            letter-spacing: 0.15em !important;
            text-transform: uppercase !important;
            color: #888 !important;
            margin-bottom: 16px !important;
          }
          .qr-card-print .scan-text-print {
            font-size: 11px !important;
            color: #333 !important;
            margin-top: 16px !important;
            font-weight: 600 !important;
          }
        }
      `}</style>

      <div className="min-h-screen bg-[#0B0E0C]">
        {/* Header */}
        <div className="no-print border-b border-[#303A31] bg-[#111A14]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/staff"
                className="flex items-center gap-2 text-[#A7AEA6] hover:text-[#F4F0E6] text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </a>
              <div className="w-px h-5 bg-[#303A31]" />
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#D7BC83]" />
                <h1 className="font-display text-lg text-[#F4F0E6]">Table QR Codes</h1>
              </div>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-[#19221B] border border-[#303A31] hover:border-[#D7BC83]/40 text-[#F4F0E6] text-sm px-4 py-2 rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print All
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="no-print max-w-6xl mx-auto px-6 py-5">
          <p className="text-[#A7AEA6] text-sm leading-relaxed max-w-2xl">
            Print these QR codes and place them on each table. Customers scan to self-check-in
            for their reservations or start a walk-in session. Each code links to the table&apos;s
            dedicated check-in page.
          </p>
        </div>

        {/* QR Grid */}
        <div
          ref={printRef}
          className="print-container max-w-6xl mx-auto px-6 pb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {tables
            .filter((t) => t.is_active !== false)
            .map((table) => (
              <div
                key={table.id}
                className="qr-card-print bg-[#19221B] border border-[#303A31] rounded-lg overflow-hidden"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-[#303A31] bg-[#111A14]">
                  <p className="club-name-print font-display text-[10px] tracking-[0.2em] text-[#D7BC83] uppercase mb-1">
                    CueClub
                  </p>
                  <h3 className="text-[#F4F0E6] font-medium text-base">{table.name}</h3>
                  <p className="text-[#A7AEA6] text-xs capitalize mt-0.5">
                    {table.table_type} · ₹{table.hourly_rate}/hr
                  </p>
                </div>

                {/* QR Code */}
                <div className="p-6 flex flex-col items-center">
                  <div className="bg-white p-4 rounded-lg">
                    <QRCodeSVG
                      value={getCheckInUrl(table.id)}
                      size={180}
                      level="H"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#0B0E0C"
                    />
                  </div>

                  <p className="scan-text-print text-[#A7AEA6] text-xs mt-4 text-center">
                    Scan to check in
                  </p>

                  {/* URL + Copy (screen only) */}
                  <div className="no-print mt-3 w-full">
                    <div className="flex items-center gap-1 bg-[#111A14] border border-[#303A31] rounded-lg px-3 py-2">
                      <span className="text-[#A7AEA6] text-[11px] truncate flex-1 select-all">
                        {getCheckInUrl(table.id)}
                      </span>
                      <button
                        onClick={() => copyUrl(table.id)}
                        className="shrink-0 p-1 hover:bg-[#19221B] rounded transition-colors"
                        title="Copy URL"
                      >
                        {copied === table.id ? (
                          <Check className="w-3.5 h-3.5 text-[#30BD83]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-[#A7AEA6]" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
