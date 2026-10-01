import { useMemo, useState } from "react";
import { FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, displayNameOf } from "@/src/context/AppContext";
import { useNotes } from "@/src/lib/hooks";
import { supabase } from "@/src/lib/supabase";
import { timeAgo } from "@/src/lib/format";
import {
  EmptyState, Field, GhostButton, IconCircle, PressableScale, PrimaryButton, SearchBar,
  SkeletonCard, Ionicons, useToast,
} from "@/src/components/core";
import { Sheet, ConfirmSheet } from "@/src/components/sheets";
import { useTheme, spacing, radius } from "@/src/theme";
import type { Note } from "@/src/lib/types";

export default function Notes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { members, session, household } = useApp();
  const notes = useNotes();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = notes.data ?? [];
    if (!q) return list;
    // Sensitive content is never searched — only titles.
    return list.filter((n) => n.title.toLowerCase().includes(q) || (!n.sensitive && (n.content ?? "").toLowerCase().includes(q)));
  }, [notes.data, search]);

  const memberById = (id: string | null) => members.find((m) => m.user_id === id);

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("notes").delete().eq("id", deleting.id);
    if (error) toast(error.message, "error");
    else toast("Note deleted", "info");
    setDeleting(null);
    setEditing(null);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.md, gap: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Pressable testID="notes-back" onPress={() => router.back()} hitSlop={12}>
            <IconCircle icon="chevron-back" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: "600", letterSpacing: -0.5, color: colors.onSurface }}>Shared notes</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>{notes.data?.length ?? 0} notes for the whole house</Text>
          </View>
          <PressableScale testID="notes-add" onPress={() => setEditing("new")}>
            <IconCircle icon="add" tone="dark" />
          </PressableScale>
        </View>
        <SearchBar testID="notes-search" value={search} onChangeText={setSearch} placeholder="Search notes" />
      </View>

      {notes.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}><SkeletonCard /><SkeletonCard /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title={search ? "No matching notes" : "Nothing written down yet"}
              subtitle="Wi-Fi password, landlord's number, emergency contacts — keep them where everyone can find them."
              actionLabel={search ? undefined : "Add first note"}
              actionTestID="notes-empty-add"
              onAction={search ? undefined : () => setEditing("new")}
            />
          }
          renderItem={({ item }) => {
            const hidden = item.sensitive && !revealed[item.id];
            return (
              <PressableScale testID={`note-card-${item.id}`} onPress={() => setEditing(item)}>
                <View style={{
                  backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1,
                  borderColor: colors.border, padding: spacing.lg, gap: spacing.sm,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    {item.sensitive ? <Ionicons name="lock-closed" size={14} color={colors.warning} /> : null}
                    <Text style={{ flex: 1, fontSize: 17, fontWeight: "600", color: colors.onSurface }}>{item.title}</Text>
                    {item.sensitive ? (
                      <Pressable
                        testID={`note-reveal-${item.id}`}
                        onPress={() => setRevealed((r) => ({ ...r, [item.id]: !r[item.id] }))}
                        hitSlop={10}
                        accessibilityLabel={hidden ? "Show note" : "Hide note"}
                      >
                        <IconCircle icon={hidden ? "eye-outline" : "eye-off-outline"} size={36} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text testID={`note-content-${item.id}`} numberOfLines={hidden ? 1 : 6}
                    style={{ fontSize: 14, color: hidden ? colors.muted : colors.onSurfaceTertiary, lineHeight: 21 }}>
                    {hidden ? "Sensitive · tap the eye to reveal" : item.content || "—"}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>
                    {displayNameOf(memberById(item.created_by))} · updated {timeAgo(item.updated_at)}
                  </Text>
                </View>
              </PressableScale>
            );
          }}
        />
      )}

      <NoteSheet
        note={editing}
        onClose={() => setEditing(null)}
        onDelete={(n) => setDeleting(n)}
        onSave={async (title, content, sensitive) => {
          if (!household || !session?.user) return;
          const isNew = editing === "new";
          const { error } = isNew
            ? await supabase.from("notes").insert({ household_id: household.id, title, content, sensitive, created_by: session.user.id })
            : await supabase.from("notes").update({ title, content, sensitive }).eq("id", (editing as Note).id);
          if (error) {
            toast(error.message, "error");
            return;
          }
          toast(isNew ? "Note added" : "Note saved", "success");
          setEditing(null);
        }}
      />

      <ConfirmSheet
        visible={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleting?.title}"?`}
        message="This removes it for everyone in the household."
        confirmLabel="Delete"
        destructive
        confirmTestID="note-delete-confirm"
      />
    </View>
  );
}

function NoteSheet({ note, onClose, onSave, onDelete }: {
  note: Note | "new" | null;
  onClose: () => void;
  onSave: (title: string, content: string, sensitive: boolean) => Promise<void>;
  onDelete: (n: Note) => void;
}) {
  const { colors } = useTheme();
  const existing = note && note !== "new" ? note : null;
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Reset form whenever a different note is opened.
  const key = note === "new" ? "new" : existing?.id ?? null;
  if (key !== lastKey) {
    setLastKey(key);
    setTitle(existing?.title ?? "");
    setContent(existing?.content ?? "");
    setSensitive(existing?.sensitive ?? false);
    setError(null);
  }

  async function save() {
    if (!title.trim()) return setError("Give the note a title");
    setLoading(true);
    await onSave(title.trim(), content.trim(), sensitive);
    setLoading(false);
  }

  return (
    <Sheet visible={!!note} onClose={onClose} title={existing ? "Edit note" : "New note"}>
      <View style={{ gap: spacing.md }}>
        <Field label="Title" testID="note-title" value={title} onChangeText={setTitle} placeholder="Wi-Fi password" />
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginLeft: 4 }}>Content</Text>
          <TextInput
            testID="note-content-input"
            value={content}
            onChangeText={setContent}
            multiline
            placeholder="Network: PalmHouse_5G · Password: …"
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
              paddingHorizontal: 18, paddingTop: 14, minHeight: 110, maxHeight: 200, fontSize: 16,
              color: colors.onSurface, textAlignVertical: "top",
            }}
          />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text style={{ fontSize: 14, color: colors.onSurface }}>Sensitive</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Hidden in previews until someone taps to reveal</Text>
          </View>
          <Switch testID="note-sensitive-toggle" value={sensitive} onValueChange={setSensitive} />
        </View>
        {error ? <Text style={{ color: colors.error, fontSize: 13 }}>{error}</Text> : null}
        <PrimaryButton testID="note-save" label={existing ? "Save note" : "Add note"} onPress={save} loading={loading} />
        {existing ? <GhostButton testID="note-delete" label="Delete note" icon="trash-outline" onPress={() => onDelete(existing)} /> : null}
      </View>
    </Sheet>
  );
}
