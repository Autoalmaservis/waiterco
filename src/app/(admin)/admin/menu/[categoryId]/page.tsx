import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getAdminContext } from "@/lib/admin-context"
import { createClient } from "@/lib/supabase/server"
import CategoryItemsClient from "./CategoryItemsClient"

export default async function CategoryItemsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const ctx = await getAdminContext()
  if (!ctx) redirect("/login")

  const { categoryId } = await params
  const supabase = await createClient()

  const venueIds = ctx.venues.map((v) => v.id)

  const { data: category } = await supabase
    .from("menu_categories")
    .select("*")
    .eq("id", categoryId)
    .in("venue_id", venueIds)
    .single()

  if (!category) notFound()

  const { data: items } = await supabase
    .from("menu_items")
    .select("*")
    .eq("category_id", categoryId)
    .order("sort_order")

  const itemIds = (items ?? []).map((i) => i.id)
  let modifierGroups: any[] = []
  let modifiers: any[] = []
  if (itemIds.length > 0) {
    const [groupsRes, modsRes] = await Promise.all([
      (supabase as any)
        .from("item_modifier_groups")
        .select("id, item_id, name, min_select, max_select, sort_order")
        .in("item_id", itemIds)
        .order("sort_order"),
      (supabase as any)
        .from("item_modifiers")
        .select("id, group_id, name, price, is_available, sort_order")
        .order("sort_order"),
    ])
    modifierGroups = groupsRes.data ?? []
    modifiers = modsRes.data ?? []
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/menu"
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{category.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">Kategória menu</p>
        </div>
      </div>

      <CategoryItemsClient
        items={items ?? []}
        categoryId={categoryId}
        venueId={category.venue_id}
        modifierGroups={modifierGroups}
        modifiers={modifiers}
      />
    </div>
  )
}
