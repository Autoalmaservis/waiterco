// Makes all fields whose type includes `null` optional in Insert/Update payloads
type Insertable<T> = {
  [K in keyof T as null extends T[K] ? K : never]?: T[K]
} & {
  [K in keyof T as null extends T[K] ? never : K]: T[K]
}

export type UserRole = "super_admin" | "restaurant_admin" | "manager" | "waiter" | "kitchen" | "bar" | "customer"
export type VenueType = "restaurant" | "bar" | "hotel" | "cafe"
export type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled"
export type OrderItemStatus = "pending" | "preparing" | "ready" | "delivered" | "cancelled"
export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded"
export type PaymentMethod = "cash" | "card" | "apple_pay" | "google_pay"
export type SessionStatus = "active" | "closed" | "abandoned"
export type SubscriptionPlan = "free" | "basic" | "pro" | "enterprise"
export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled"
export type WaiterCallReason = "help" | "water" | "bill" | "other"
export type WaiterCallStatus = "pending" | "acknowledged" | "resolved"
export type LoyaltyType = "stamps" | "points"
export type StaffRole = "manager" | "waiter" | "cook" | "barman"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          avatar_url: string | null
          role: UserRole
          language: string
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">>
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          owner_id: string
          name: string
          logo_url: string | null
          billing_email: string | null
          ico: string | null
          dic: string | null
          ic_dph: string | null
          street: string | null
          city: string | null
          postal_code: string | null
          country: string | null
          phone: string | null
          website: string | null
          created_at: string
          updated_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["organizations"]["Row"], "id" | "created_at" | "updated_at">>
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>
        Relationships: []
      }
      venues: {
        Row: {
          id: string
          organization_id: string
          name: string
          slug: string
          type: VenueType
          description: string | null
          logo_url: string | null
          cover_image_url: string | null
          address: string | null
          city: string | null
          country: string
          phone: string | null
          email: string | null
          website: string | null
          currency: string
          timezone: string
          primary_color: string | null
          is_active: boolean
          is_open: boolean
          closed_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["venues"]["Row"], "id" | "created_at" | "updated_at">>
        Update: Partial<Database["public"]["Tables"]["venues"]["Insert"]>
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          plan: SubscriptionPlan
          status: SubscriptionStatus
          started_at: string
          expires_at: string | null
          monthly_price: number | null
          stripe_subscription_id: string | null
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          session_id: string
          table_id: string
          venue_id: string
          customer_id: string | null
          order_number: string
          round_number: number
          status: OrderStatus
          total_amount: number
          notes: string | null
          created_at: string
          confirmed_at: string | null
          ready_at: string | null
          delivered_at: string | null
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          session_id: string
          venue_id: string
          amount: number
          tip_amount: number
          total_amount: number
          payment_method: PaymentMethod
          status: PaymentStatus
          stripe_payment_intent_id: string | null
          receipt_email: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>
        Relationships: []
      }
      menu_items: {
        Row: {
          id: string
          venue_id: string
          category_id: string
          name: string
          description: string | null
          image_url: string | null
          base_price: number
          preparation_time: number | null
          calories: number | null
          allergens: string[]
          tags: string[]
          is_active: boolean
          is_available: boolean
          unavailable_reason: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["menu_items"]["Row"], "id" | "created_at" | "updated_at">>
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>
        Relationships: []
      }
      menu_categories: {
        Row: {
          id: string
          venue_id: string
          name: string
          description: string | null
          image_url: string | null
          sort_order: number
          is_active: boolean
          available_from: string | null
          available_to: string | null
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["menu_categories"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["menu_categories"]["Insert"]>
        Relationships: []
      }
      tables: {
        Row: {
          id: string
          venue_id: string
          zone_id: string | null
          name: string
          capacity: number | null
          qr_token: string
          is_active: boolean
          x_pos: number
          y_pos: number
          shape: string
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["tables"]["Row"], "id" | "qr_token" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["tables"]["Insert"]>
        Relationships: []
      }
      table_sessions: {
        Row: {
          id: string
          table_id: string
          venue_id: string
          share_token: string
          status: SessionStatus
          customer_count: number | null
          opened_at: string
          closed_at: string | null
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["table_sessions"]["Row"], "id" | "share_token" | "opened_at">>
        Update: Partial<Database["public"]["Tables"]["table_sessions"]["Insert"]>
        Relationships: []
      }
      waiter_calls: {
        Row: {
          id: string
          session_id: string
          table_id: string
          venue_id: string
          reason: WaiterCallReason
          custom_message: string | null
          status: WaiterCallStatus
          created_at: string
          acknowledged_at: string | null
          resolved_at: string | null
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["waiter_calls"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["waiter_calls"]["Insert"]>
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          venue_id: string
          customer_id: string | null
          session_id: string | null
          overall_rating: number
          food_rating: number | null
          service_rating: number | null
          comment: string | null
          is_visible: boolean
          venue_response: string | null
          responded_at: string | null
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["reviews"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>
        Relationships: []
      }
      venue_staff: {
        Row: {
          id: string
          venue_id: string
          user_id: string
          role: StaffRole
          is_active: boolean
          joined_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["venue_staff"]["Row"], "id" | "joined_at">>
        Update: Partial<Database["public"]["Tables"]["venue_staff"]["Insert"]>
        Relationships: []
      }
      venue_zones: {
        Row: {
          id: string
          venue_id: string
          name: string
          description: string | null
          sort_order: number
          is_active: boolean
          x_pos: number
          y_pos: number
          w: number
          h: number
          color: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["venue_zones"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["venue_zones"]["Insert"]>
        Relationships: []
      }
      support_tickets: {
        Row: {
          id: string
          organization_id: string
          created_by: string | null
          subject: string
          status: string
          priority: string
          created_at: string
          updated_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["support_tickets"]["Row"], "id" | "created_at" | "updated_at">>
        Update: Partial<Database["public"]["Tables"]["support_tickets"]["Insert"]>
        Relationships: []
      }
      support_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_id: string | null
          message: string
          is_staff: boolean
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["support_messages"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["support_messages"]["Insert"]>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          actor_role: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          old_data: Record<string, unknown> | null
          new_data: Record<string, unknown> | null
          ip_address: string | null
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>
        Relationships: []
      }
      feature_flags: {
        Row: {
          id: string
          key: string
          venue_id: string | null
          is_enabled: boolean
          updated_by: string | null
          updated_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["feature_flags"]["Row"], "id" | "updated_at">>
        Update: Partial<Database["public"]["Tables"]["feature_flags"]["Insert"]>
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          venue_id: string | null
          user_id: string | null
          type: string
          title: string
          body: string | null
          data: Record<string, unknown> | null
          is_read: boolean
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>
        Relationships: []
      }
      special_offers: {
        Row: {
          id: string
          venue_id: string
          name: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          item_ids: string[] | null
          valid_from: string | null
          valid_to: string | null
          days_of_week: number[] | null
          is_active: boolean
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["special_offers"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["special_offers"]["Insert"]>
        Relationships: []
      }
      customer_favorites: {
        Row: {
          id: string
          customer_id: string
          venue_id: string | null
          item_id: string | null
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["customer_favorites"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["customer_favorites"]["Insert"]>
        Relationships: []
      }
      menu_translations: {
        Row: {
          id: string
          resource_type: string
          resource_id: string
          language: string
          name: string | null
          description: string | null
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["menu_translations"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["menu_translations"]["Insert"]>
        Relationships: []
      }
      opening_hours: {
        Row: {
          id: string
          venue_id: string
          day_of_week: number
          open_time: string
          close_time: string
          is_closed: boolean
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["opening_hours"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["opening_hours"]["Insert"]>
        Relationships: []
      }
      item_variant_groups: {
        Row: {
          id: string
          venue_id: string
          item_id: string
          name: string
          is_required: boolean
          sort_order: number
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["item_variant_groups"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["item_variant_groups"]["Insert"]>
        Relationships: []
      }
      item_variants: {
        Row: {
          id: string
          group_id: string
          name: string
          price_delta: number
          is_default: boolean
          is_available: boolean
          sort_order: number
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["item_variants"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["item_variants"]["Insert"]>
        Relationships: []
      }
      item_modifier_groups: {
        Row: {
          id: string
          venue_id: string
          item_id: string
          name: string
          min_select: number
          max_select: number | null
          sort_order: number
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["item_modifier_groups"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["item_modifier_groups"]["Insert"]>
        Relationships: []
      }
      item_modifiers: {
        Row: {
          id: string
          group_id: string
          name: string
          price: number
          is_available: boolean
          sort_order: number
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["item_modifiers"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["item_modifiers"]["Insert"]>
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string | null
          variant_id: string | null
          name: string
          quantity: number
          unit_price: number
          total_price: number
          status: OrderItemStatus
          notes: string | null
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["order_items"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>
        Relationships: []
      }
      order_item_modifiers: {
        Row: {
          id: string
          order_item_id: string
          modifier_id: string | null
          name: string
          price: number
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["order_item_modifiers"]["Row"], "id">>
        Update: Partial<Database["public"]["Tables"]["order_item_modifiers"]["Insert"]>
        Relationships: []
      }
      loyalty_programs: {
        Row: {
          id: string
          venue_id: string
          name: string
          type: LoyaltyType
          stamps_required: number | null
          points_per_eur: number | null
          reward_description: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["loyalty_programs"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["loyalty_programs"]["Insert"]>
        Relationships: []
      }
      loyalty_cards: {
        Row: {
          id: string
          program_id: string
          venue_id: string
          customer_id: string | null
          stamps: number
          points: number
          created_at: string
          updated_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["loyalty_cards"]["Row"], "id" | "created_at" | "updated_at">>
        Update: Partial<Database["public"]["Tables"]["loyalty_cards"]["Insert"]>
        Relationships: []
      }
      item_reviews: {
        Row: {
          id: string
          venue_id: string
          item_id: string
          customer_id: string | null
          session_id: string | null
          rating: number
          comment: string | null
          is_visible: boolean
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["item_reviews"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["item_reviews"]["Insert"]>
        Relationships: []
      }
      payment_splits: {
        Row: {
          id: string
          payment_id: string
          session_id: string
          customer_id: string | null
          amount: number
          tip_amount: number
          payment_method: PaymentMethod
          status: PaymentStatus
          stripe_payment_intent_id: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["payment_splits"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["payment_splits"]["Insert"]>
        Relationships: []
      }
      venue_closures: {
        Row: {
          id: string
          venue_id: string
          date: string
          reason: string | null
          created_at: string
        }
        Insert: Insertable<Omit<Database["public"]["Tables"]["venue_closures"]["Row"], "id" | "created_at">>
        Update: Partial<Database["public"]["Tables"]["venue_closures"]["Insert"]>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      venue_type: VenueType
      order_status: OrderStatus
      order_item_status: OrderItemStatus
      payment_status: PaymentStatus
      payment_method: PaymentMethod
      session_status: SessionStatus
      subscription_plan: SubscriptionPlan
      subscription_status: SubscriptionStatus
      waiter_call_reason: WaiterCallReason
      waiter_call_status: WaiterCallStatus
      loyalty_type: LoyaltyType
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience Row types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
export type Venue = Database["public"]["Tables"]["venues"]["Row"]
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"]
export type Order = Database["public"]["Tables"]["orders"]["Row"]
export type Payment = Database["public"]["Tables"]["payments"]["Row"]
export type MenuItem = Database["public"]["Tables"]["menu_items"]["Row"]
export type MenuCategory = Database["public"]["Tables"]["menu_categories"]["Row"]
export type DBTable = Database["public"]["Tables"]["tables"]["Row"]
export type TableSession = Database["public"]["Tables"]["table_sessions"]["Row"]
export type WaiterCall = Database["public"]["Tables"]["waiter_calls"]["Row"]
export type Review = Database["public"]["Tables"]["reviews"]["Row"]
export type VenueStaff = Database["public"]["Tables"]["venue_staff"]["Row"]
export type SupportTicket = Database["public"]["Tables"]["support_tickets"]["Row"]
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"]
export type FeatureFlag = Database["public"]["Tables"]["feature_flags"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
export type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"]
export type OpeningHours = Database["public"]["Tables"]["opening_hours"]["Row"]
export type ItemVariantGroup = Database["public"]["Tables"]["item_variant_groups"]["Row"]
export type ItemVariant = Database["public"]["Tables"]["item_variants"]["Row"]
export type ItemModifierGroup = Database["public"]["Tables"]["item_modifier_groups"]["Row"]
export type ItemModifier = Database["public"]["Tables"]["item_modifiers"]["Row"]
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"]
export type OrderItemModifier = Database["public"]["Tables"]["order_item_modifiers"]["Row"]
export type LoyaltyProgram = Database["public"]["Tables"]["loyalty_programs"]["Row"]
export type LoyaltyCard = Database["public"]["Tables"]["loyalty_cards"]["Row"]
export type ItemReview = Database["public"]["Tables"]["item_reviews"]["Row"]
export type PaymentSplit = Database["public"]["Tables"]["payment_splits"]["Row"]
export type VenueClosure = Database["public"]["Tables"]["venue_closures"]["Row"]
export type VenueZone = Database["public"]["Tables"]["venue_zones"]["Row"]
