"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Protected from "@/components/Protected";
import { StatusBadge, Spinner } from "@/components/ui";
import { api } from "@/lib/client";
import type { PopupFolder } from "@/lib/types";

interface PopupRow {
  id: string;
  name: string;
  site: string;
  status: string;
  folderId: string;
  submissionCount: number;
  updatedAt: string;
}

function PopupsInner() {
  const [popups, setPopups] = useState<PopupRow[]>([]);
  const [folders, setFolders] = useState<PopupFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [newFolder, setNewFolder] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [popupResponse, folderResponse] = await Promise.all([
      api<{ popups: PopupRow[] }>("/api/admin/popups"),
      api<{ folders: PopupFolder[] }>("/api/admin/folders"),
    ]);
    if (popupResponse.ok && popupResponse.data?.popups)
      setPopups(popupResponse.data.popups);
    if (folderResponse.ok && folderResponse.data?.folders)
      setFolders(folderResponse.data.folders);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createFolder() {
    if (!newFolder.trim()) return;
    const response = await api<{ folder: PopupFolder }>("/api/admin/folders", {
      method: "POST",
      body: JSON.stringify({ name: newFolder }),
    });
    if (response.ok && response.data?.folder)
      setFolders((previous) => [...previous, response.data.folder]);
    setNewFolder("");
  }

  async function renameFolder(folder: PopupFolder) {
    const name = window.prompt("New folder name", folder.name)?.trim();
    if (!name || name === folder.name) return;
    const response = await api<{ folder: PopupFolder }>(
      `/api/admin/folders/${folder.id}`,
      { method: "PUT", body: JSON.stringify({ name }) },
    );
    if (response.ok && response.data?.folder)
      setFolders((previous) =>
        previous.map((item) =>
          item.id === folder.id ? response.data!.folder : item,
        ),
      );
  }

  async function deleteFolder(folder: PopupFolder) {
    if (
      folder.id === "uncategorized" ||
      !window.confirm(
        `Delete ${folder.name}? Its popups will move to Uncategorized.`,
      )
    )
      return;
    const response = await api(`/api/admin/folders/${folder.id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      setFolders((previous) =>
        previous.filter((item) => item.id !== folder.id),
      );
      if (selectedFolder === folder.id) setSelectedFolder("all");
      await load();
    }
  }

  async function clonePopup(id: string) {
    const response = await api<{ popup: PopupRow }>(
      `/api/admin/popups/${id}/clone`,
      { method: "POST" },
    );
    if (response.ok && response.data?.popup)
      window.location.href = `/admin/popups/${response.data.popup.id}`;
  }

  const filtered = useMemo(
    () =>
      selectedFolder === "all"
        ? popups
        : popups.filter((popup) => popup.folderId === selectedFolder),
    [popups, selectedFolder],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, PopupRow[]>();
    filtered.forEach((popup) =>
      groups.set(popup.folderId || "uncategorized", [
        ...(groups.get(popup.folderId || "uncategorized") || []),
        popup,
      ]),
    );
    return groups;
  }, [filtered]);
  const folderName = (id: string) =>
    folders.find((folder) => folder.id === id)?.name || "Uncategorized";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Popups</h1>
        <Link
          href="/admin/popups/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + New Popup
        </Link>
      </div>
      <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
          >
            <option value="all">All folders</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            placeholder="New folder name"
          />
          <button
            type="button"
            onClick={createFolder}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700"
          >
            Create folder
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {folders
            .filter((folder) => folder.id !== "uncategorized")
            .map((folder) => (
              <span
                key={folder.id}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
              >
                {folder.name}
                <button
                  type="button"
                  onClick={() => renameFolder(folder)}
                  aria-label={`Rename ${folder.name}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => deleteFolder(folder)}
                  aria-label={`Delete ${folder.name}`}
                >
                  ×
                </button>
              </span>
            ))}
        </div>
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="mt-6 space-y-5">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500">
              No popups in this folder.
            </div>
          ) : (
            Array.from(grouped.entries()).map(([folderId, items]) => (
              <section
                key={folderId}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 font-semibold text-gray-800">
                  {folderName(folderId)}{" "}
                  <span className="text-xs font-normal text-gray-500">
                    ({items.length})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="px-5 py-3 font-medium">Name</th>
                        <th className="px-5 py-3 font-medium">Site</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium">Submissions</th>
                        <th className="px-5 py-3 font-medium">Updated</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((popup) => (
                        <tr key={popup.id} className="border-t border-gray-100">
                          <td className="px-5 py-3">
                            <div className="font-medium text-gray-900">
                              {popup.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {popup.id}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {popup.site || "—"}
                          </td>
                          <td className="px-5 py-3">
                            <StatusBadge status={popup.status} />
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {popup.submissionCount}
                          </td>
                          <td className="px-5 py-3 text-gray-500">
                            {new Date(popup.updatedAt).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex justify-end gap-3">
                              <Link
                                href={`/admin/popups/${popup.id}`}
                                className="text-sm font-medium text-blue-600 hover:underline"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                onClick={() => clonePopup(popup.id)}
                                className="text-sm font-medium text-gray-600 hover:underline"
                              >
                                Clone
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function PopupsPage() {
  return (
    <Protected>
      <PopupsInner />
    </Protected>
  );
}
