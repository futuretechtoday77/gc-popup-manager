"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Protected from "@/components/Protected";
import PopupForm, {
  fromPopup,
  toPayload,
  type PopupFormValue,
} from "@/components/PopupForm";
import CopyBox from "@/components/CopyBox";
import { StatusBadge, Spinner } from "@/components/ui";
import { api } from "@/lib/client";
import type { Popup, Submission } from "@/lib/types";


function EmbedInstructions({
  popupId,
  triggerType,
  embedUrl,
  legacySnippet,
  showLegacyEmbed,
  onToggleLegacy,
}: {
  popupId: string;
  triggerType: Popup["trigger"]["type"];
  embedUrl: string;
  legacySnippet: string;
  showLegacyEmbed: boolean;
  onToggleLegacy: () => void;
}) {
  const universalScript = `<script src="${embedUrl}" async></script>`;
  const buttonTrigger = `<button data-gc-popup-trigger="${popupId}">Your button text</button>`;
  const siteWideAuto = `<script data-gc-popup="${popupId}" async></script>`;
  const pageOverride = `<script data-gc-popup="${popupId}" data-gc-override async></script>`;
  const isButton = triggerType === "button";

  return (
    <div className="mt-5 space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-gray-900">
          Universal Script (install once site-wide)
        </h3>
        <p className="mb-2 mt-1 text-sm text-gray-500">
          Add this once to your site theme: in the header or before the closing body tag. You only need one copy across your whole site.
        </p>
        <CopyBox value={universalScript} />
      </section>

      {isButton ? (
        <section>
          <h3 className="text-sm font-semibold text-gray-900">Button trigger</h3>
          <p className="mb-2 mt-1 text-sm text-gray-500">
            Place this wherever you want the button on the page. Click always opens the popup regardless of prior visits.
          </p>
          <CopyBox value={buttonTrigger} />
        </section>
      ) : (
        <section className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Site-wide auto popup (fires on every page)
            </h3>
            <p className="mb-2 mt-1 text-sm text-gray-500">
              Add this to your site theme alongside the universal script.
            </p>
            <CopyBox value={siteWideAuto} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Page override (suppresses site-wide popup on this page)
            </h3>
            <p className="mb-2 mt-1 text-sm text-gray-500">
              Add this in an individual page template to replace the site-wide auto popup there.
            </p>
            <CopyBox value={pageOverride} />
          </div>
        </section>
      )}

      <section className="border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onToggleLegacy}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
        >
          {showLegacyEmbed ? "Hide legacy embed" : "Show legacy embed"}
        </button>
        {showLegacyEmbed && (
          <div className="mt-3">
            <p className="mb-2 text-sm text-gray-500">
              Legacy per-popup snippet: use only for existing installations that have not moved to the universal script.
            </p>
            <CopyBox value={legacySnippet} />
          </div>
        )}
      </section>
    </div>
  );
}

function EditInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [initial, setInitial] = useState<PopupFormValue | null>(null);
  const [legacySnippet, setLegacySnippet] = useState("");
  const [showLegacyEmbed, setShowLegacyEmbed] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [p, e, s] = await Promise.all([
      api<{ popup: Popup }>(`/api/admin/popups/${id}`),
      api<{ snippet: string }>(`/api/admin/popups/${id}/embed`),
      api<{ submissions: Submission[] }>(`/api/admin/popups/${id}/submissions`),
    ]);
    if (p.ok && p.data?.popup) setInitial(fromPopup(p.data.popup));
    if (e.ok && e.data?.snippet) setLegacySnippet(e.data.snippet);
    if (s.ok && s.data?.submissions) setSubmissions(s.data.submissions);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(v: PopupFormValue) {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const res = await api<{ success: boolean; error?: string }>(
      `/api/admin/popups/${id}`,
      { method: "PUT", body: JSON.stringify(toPayload(v)) },
    );
    setSubmitting(false);
    if (res.ok) {
      setMessage("Saved.");
      setTimeout(() => setMessage(null), 2000);
    } else {
      setError(res.data?.error || "Failed to save");
    }
  }

  async function onDelete() {
    if (!confirm("Set this popup to inactive?")) return;
    const res = await api(`/api/admin/popups/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/popups");
  }

  async function onClone() {
    const res = await api<{ popup?: Popup }>(`/api/admin/popups/${id}/clone`, {
      method: "POST",
    });
    if (res.ok && res.data?.popup)
      router.push(`/admin/popups/${res.data.popup.id}`);
  }

  if (loading) return <Spinner />;
  if (!initial)
    return (
      <div className="text-sm text-gray-500">
        Popup not found.{" "}
        <button
          onClick={() => router.push("/admin/popups")}
          className="text-blue-600 hover:underline"
        >
          Back to popups
        </button>
      </div>
    );

  const recent = submissions.slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{initial.name}</h1>
          <p className="text-sm text-gray-400">{initial.id}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClone}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clone
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Deactivate
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900">Install this popup</h2>
        <p className="mt-1 text-sm text-gray-500">
          Use the universal script once, then add the trigger markup that fits this popup.
        </p>
        {legacySnippet ? (
          <EmbedInstructions
            popupId={initial.id}
            triggerType={initial.trigger.type}
            embedUrl={legacySnippet.match(/src="([^"]+)"/)?.[1] || `${window.location.origin}/embed.js`}
            legacySnippet={legacySnippet}
            showLegacyEmbed={showLegacyEmbed}
            onToggleLegacy={() => setShowLegacyEmbed((shown) => !shown)}
          />
        ) : (
          <div className="mt-4"><Spinner /></div>
        )}
      </div>

      {message && (
        <p className="mt-4 text-sm font-medium text-green-600">{message}</p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        <PopupForm
          initial={initial}
          isNew={false}
          onSubmit={onSubmit}
          submitting={submitting}
        />
      </div>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="font-semibold text-gray-900">Recent submissions</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            No submissions yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-5 py-2 font-medium">Email</th>
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-5 py-2.5 text-gray-900">{s.email}</td>
                    <td className="px-5 py-2.5 text-gray-600">
                      {s.firstName || "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-2.5 text-gray-500">
                      {new Date(s.submittedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditPopupPage() {
  return (
    <Protected>
      <EditInner />
    </Protected>
  );
}
