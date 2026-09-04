export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_cards: {
        Row: {
          active: boolean
          card_number: string
          created_at: string
          estate_id: string
          id: string
          issued_at: string
          notes: string | null
          resident_id: string
          revoked_at: string | null
        }
        Insert: {
          active?: boolean
          card_number: string
          created_at?: string
          estate_id: string
          id?: string
          issued_at?: string
          notes?: string | null
          resident_id: string
          revoked_at?: string | null
        }
        Update: {
          active?: boolean
          card_number?: string
          created_at?: string
          estate_id?: string
          id?: string
          issued_at?: string
          notes?: string | null
          resident_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_cards_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      access_devices: {
        Row: {
          created_at: string
          device_token_hash: string | null
          device_type: string
          estate_id: string
          id: string
          last_seen_at: string | null
          last_sync_at: string | null
          location: string | null
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_token_hash?: string | null
          device_type: string
          estate_id: string
          id?: string
          last_seen_at?: string | null
          last_sync_at?: string | null
          location?: string | null
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_token_hash?: string | null
          device_type?: string
          estate_id?: string
          id?: string
          last_seen_at?: string | null
          last_sync_at?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_devices_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          estate_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          estate_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          estate_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          collection_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          estate_id: string
          id: string
          resident_id: string
          status: Database["public"]["Enums"]["bill_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          collection_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          estate_id: string
          id?: string
          resident_id: string
          status?: Database["public"]["Enums"]["bill_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          collection_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          estate_id?: string
          id?: string
          resident_id?: string
          status?: Database["public"]["Enums"]["bill_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      biometric_access: {
        Row: {
          access_status: string
          approved_at: string | null
          approved_by: string | null
          biometric_type: string
          created_at: string
          dependent_id: string | null
          device_id: string | null
          enrollment_status: string
          estate_id: string
          external_credential_ref: string | null
          id: string
          last_used_at: string | null
          notes: string | null
          resident_id: string | null
          updated_at: string
        }
        Insert: {
          access_status?: string
          approved_at?: string | null
          approved_by?: string | null
          biometric_type: string
          created_at?: string
          dependent_id?: string | null
          device_id?: string | null
          enrollment_status?: string
          estate_id: string
          external_credential_ref?: string | null
          id?: string
          last_used_at?: string | null
          notes?: string | null
          resident_id?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: string
          approved_at?: string | null
          approved_by?: string | null
          biometric_type?: string
          created_at?: string
          dependent_id?: string | null
          device_id?: string | null
          enrollment_status?: string
          estate_id?: string
          external_credential_ref?: string | null
          id?: string
          last_used_at?: string | null
          notes?: string | null
          resident_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biometric_access_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_access_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "dependents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_access_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_access_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_access_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      biometric_access_events: {
        Row: {
          biometric_access_id: string | null
          biometric_type: string | null
          created_at: string
          dependent_id: string | null
          device_id: string | null
          estate_id: string
          id: string
          outcome: string
          reason: string | null
          resident_id: string | null
        }
        Insert: {
          biometric_access_id?: string | null
          biometric_type?: string | null
          created_at?: string
          dependent_id?: string | null
          device_id?: string | null
          estate_id: string
          id?: string
          outcome: string
          reason?: string | null
          resident_id?: string | null
        }
        Update: {
          biometric_access_id?: string | null
          biometric_type?: string | null
          created_at?: string
          dependent_id?: string | null
          device_id?: string | null
          estate_id?: string
          id?: string
          outcome?: string
          reason?: string | null
          resident_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biometric_access_events_biometric_access_id_fkey"
            columns: ["biometric_access_id"]
            isOneToOne: false
            referencedRelation: "biometric_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_access_events_dependent_id_fkey"
            columns: ["dependent_id"]
            isOneToOne: false
            referencedRelation: "dependents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_access_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "access_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_access_events_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_access_events_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          body: string | null
          created_at: string
          estate_id: string
          id: string
          read_at: string | null
          resident_id: string
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          estate_id: string
          id?: string
          read_at?: string | null
          resident_id: string
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          estate_id?: string
          id?: string
          read_at?: string | null
          resident_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          amount: number
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          estate_id: string
          exclude_from_waiver: boolean
          id: string
          is_optional: boolean
          is_periodic: boolean
          is_utility: boolean
          payment_cycle: string | null
          payment_type: string
          priority: number
          scope: string
          status: string
          sub_account: string | null
          tag: string | null
          target_address: string | null
          title: string
          topup_allowed: boolean
          updated_at: string
        }
        Insert: {
          amount?: number
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          estate_id: string
          exclude_from_waiver?: boolean
          id?: string
          is_optional?: boolean
          is_periodic?: boolean
          is_utility?: boolean
          payment_cycle?: string | null
          payment_type?: string
          priority?: number
          scope?: string
          status?: string
          sub_account?: string | null
          tag?: string | null
          target_address?: string | null
          title: string
          topup_allowed?: boolean
          updated_at?: string
        }
        Update: {
          amount?: number
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          estate_id?: string
          exclude_from_waiver?: boolean
          id?: string
          is_optional?: boolean
          is_periodic?: boolean
          is_utility?: boolean
          payment_cycle?: string | null
          payment_type?: string
          priority?: number
          scope?: string
          status?: string
          sub_account?: string | null
          tag?: string | null
          target_address?: string | null
          title?: string
          topup_allowed?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string | null
          body: string
          cover_url: string | null
          created_at: string
          estate_id: string
          id: string
          post_type: string
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          cover_url?: string | null
          created_at?: string
          estate_id: string
          id?: string
          post_type?: string
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          estate_id?: string
          id?: string
          post_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      dependents: {
        Row: {
          age: number | null
          created_at: string
          estate_id: string
          full_name: string
          id: string
          phone: string | null
          relationship: string | null
          resident_id: string
        }
        Insert: {
          age?: number | null
          created_at?: string
          estate_id: string
          full_name: string
          id?: string
          phone?: string | null
          relationship?: string | null
          resident_id: string
        }
        Update: {
          age?: number | null
          created_at?: string
          estate_id?: string
          full_name?: string
          id?: string
          phone?: string | null
          relationship?: string | null
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependents_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          active: boolean
          code: string | null
          code_type: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          estate_id: string
          id: string
          min_payment_count: number | null
          min_purchase_amount: number | null
          name: string
          percent: number
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
          usage_type: string
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code?: string | null
          code_type?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          estate_id: string
          id?: string
          min_payment_count?: number | null
          min_purchase_amount?: number | null
          name: string
          percent: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          usage_type?: string
          used_count?: number
          value?: number
        }
        Update: {
          active?: boolean
          code?: string | null
          code_type?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          estate_id?: string
          id?: string
          min_payment_count?: number | null
          min_purchase_amount?: number | null
          name?: string
          percent?: number
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          usage_type?: string
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      estate_admin_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          estate_id: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          estate_id: string
          expires_at?: string
          id?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          estate_id?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "estate_admin_invites_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      estate_contacts: {
        Row: {
          created_at: string
          email: string | null
          estate_id: string
          id: string
          label: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          estate_id: string
          id?: string
          label: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          estate_id?: string
          id?: string
          label?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estate_contacts_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      estate_feature_flags: {
        Row: {
          enabled: boolean
          estate_id: string
          key: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          estate_id: string
          key: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          estate_id?: string
          key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estate_feature_flags_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      estate_subscriptions: {
        Row: {
          estate_id: string
          expires_at: string | null
          plan_id: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          estate_id: string
          expires_at?: string | null
          plan_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          estate_id?: string
          expires_at?: string | null
          plan_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estate_subscriptions_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: true
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estate_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "platform_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      estates: {
        Row: {
          address: string | null
          admin_user_id: string | null
          automatic_billing: boolean
          city: string | null
          code: string
          code_validity: string[]
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          house_numbers: string[]
          id: string
          logo_url: string | null
          name: string
          short_name: string | null
          state: string | null
          status: Database["public"]["Enums"]["estate_status"]
          streets: string[]
          unit_numbers: string[]
        }
        Insert: {
          address?: string | null
          admin_user_id?: string | null
          automatic_billing?: boolean
          city?: string | null
          code: string
          code_validity?: string[]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          house_numbers?: string[]
          id?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["estate_status"]
          streets?: string[]
          unit_numbers?: string[]
        }
        Update: {
          address?: string | null
          admin_user_id?: string | null
          automatic_billing?: boolean
          city?: string | null
          code?: string
          code_validity?: string[]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          house_numbers?: string[]
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["estate_status"]
          streets?: string[]
          unit_numbers?: string[]
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          event_id: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "event_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capacity: number | null
          category_id: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          estate_id: string | null
          faqs: Json
          id: string
          organizer_id: string
          price: number
          schedule: Json
          starts_at: string
          status: string
          title: string
          updated_at: string
          venue: string
          visibility: string
        }
        Insert: {
          capacity?: number | null
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          estate_id?: string | null
          faqs?: Json
          id?: string
          organizer_id: string
          price?: number
          schedule?: Json
          starts_at: string
          status?: string
          title: string
          updated_at?: string
          venue: string
          visibility?: string
        }
        Update: {
          capacity?: number | null
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          estate_id?: string | null
          faqs?: Json
          id?: string
          organizer_id?: string
          price?: number
          schedule?: Json
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
          venue?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_invites: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          code: string
          created_at: string
          estate_id: string
          exited_by: string | null
          expires_at: string
          guest_name: string
          id: string
          num_guests: number
          phone: string | null
          purpose: string | null
          resident_id: string
          status: Database["public"]["Enums"]["invite_status"]
          updated_at: string
          validated_by: string | null
          vehicle_number: string | null
          visit_time: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          code: string
          created_at?: string
          estate_id: string
          exited_by?: string | null
          expires_at: string
          guest_name: string
          id?: string
          num_guests?: number
          phone?: string | null
          purpose?: string | null
          resident_id: string
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
          validated_by?: string | null
          vehicle_number?: string | null
          visit_time: string
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          code?: string
          created_at?: string
          estate_id?: string
          exited_by?: string | null
          expires_at?: string
          guest_name?: string
          id?: string
          num_guests?: number
          phone?: string | null
          purpose?: string | null
          resident_id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          updated_at?: string
          validated_by?: string | null
          vehicle_number?: string | null
          visit_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_invites_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          category: string | null
          created_at: string
          description: string
          estate_id: string
          id: string
          location: string | null
          reporter_id: string | null
          reporter_role: Database["public"]["Enums"]["app_role"] | null
          resident_id: string | null
          responded_at: string | null
          responded_by: string | null
          response: string | null
          severity: Database["public"]["Enums"]["issue_severity"]
          status: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description: string
          estate_id: string
          id?: string
          location?: string | null
          reporter_id?: string | null
          reporter_role?: Database["public"]["Enums"]["app_role"] | null
          resident_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string
          estate_id?: string
          id?: string
          location?: string | null
          reporter_id?: string | null
          reporter_role?: Database["public"]["Enums"]["app_role"] | null
          resident_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          severity?: Database["public"]["Enums"]["issue_severity"]
          status?: Database["public"]["Enums"]["issue_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          estate_id: string
          id: string
          join_url: string | null
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          estate_id: string
          id?: string
          join_url?: string | null
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          estate_id?: string
          id?: string
          join_url?: string | null
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          estate_id: string | null
          id: string
          link_to: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          estate_id?: string | null
          id?: string
          link_to?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          estate_id?: string | null
          id?: string
          link_to?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string
          estate_id: string
          id: string
          method: string
          paid_at: string
          resident_id: string
        }
        Insert: {
          amount: number
          bill_id: string
          estate_id: string
          id?: string
          method?: string
          paid_at?: string
          resident_id: string
        }
        Update: {
          amount?: number
          bill_id?: string
          estate_id?: string
          id?: string
          method?: string
          paid_at?: string
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          limits: Json
          monthly_ngn: number
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          limits?: Json
          monthly_ngn?: number
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          limits?: Json
          monthly_ngn?: number
          name?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      poll_items: {
        Row: {
          created_at: string
          id: string
          options: Json
          poll_id: string
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          options?: Json
          poll_id: string
          position?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          options?: Json
          poll_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_items_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          item_id: string | null
          option_key: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id?: string | null
          option_key: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string | null
          option_key?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "poll_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_anonymous: boolean
          closes_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          estate_id: string
          how_to_win: string
          id: string
          kind: string
          options: Json
          promo_image_url: string | null
          starts_at: string | null
          title: string
        }
        Insert: {
          allow_anonymous?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estate_id: string
          how_to_win?: string
          id?: string
          kind?: string
          options?: Json
          promo_image_url?: string | null
          starts_at?: string | null
          title: string
        }
        Update: {
          allow_anonymous?: boolean
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estate_id?: string
          how_to_win?: string
          id?: string
          kind?: string
          options?: Json
          promo_image_url?: string | null
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_code: string | null
          approved: boolean
          avatar_url: string | null
          block: string | null
          created_at: string
          email: string | null
          estate_id: string | null
          full_name: string
          house_number: string | null
          id: string
          occupant_type: Database["public"]["Enums"]["occupant_type"] | null
          phone: string | null
          premium_expires_at: string | null
          premium_plan: string | null
          street: string | null
          unit: string | null
          updated_at: string
          verification_doc_path: string | null
          verification_notes: string | null
          verification_reviewed_at: string | null
          verification_reviewed_by: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at: string | null
        }
        Insert: {
          address_code?: string | null
          approved?: boolean
          avatar_url?: string | null
          block?: string | null
          created_at?: string
          email?: string | null
          estate_id?: string | null
          full_name?: string
          house_number?: string | null
          id: string
          occupant_type?: Database["public"]["Enums"]["occupant_type"] | null
          phone?: string | null
          premium_expires_at?: string | null
          premium_plan?: string | null
          street?: string | null
          unit?: string | null
          updated_at?: string
          verification_doc_path?: string | null
          verification_notes?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at?: string | null
        }
        Update: {
          address_code?: string | null
          approved?: boolean
          avatar_url?: string | null
          block?: string | null
          created_at?: string
          email?: string | null
          estate_id?: string | null
          full_name?: string
          house_number?: string | null
          id?: string
          occupant_type?: Database["public"]["Enums"]["occupant_type"] | null
          phone?: string | null
          premium_expires_at?: string | null
          premium_plan?: string | null
          street?: string | null
          unit?: string | null
          updated_at?: string
          verification_doc_path?: string | null
          verification_notes?: string | null
          verification_reviewed_at?: string | null
          verification_reviewed_by?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verification_submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          attendee_name: string
          attendee_phone: string | null
          checked_in_at: string | null
          created_at: string
          event_id: string
          id: string
          status: string
          ticket_id: string | null
          user_id: string
          validation_code: string
        }
        Insert: {
          attendee_name: string
          attendee_phone?: string | null
          checked_in_at?: string | null
          created_at?: string
          event_id: string
          id?: string
          status?: string
          ticket_id?: string | null
          user_id: string
          validation_code: string
        }
        Update: {
          attendee_name?: string
          attendee_phone?: string | null
          checked_in_at?: string | null
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          ticket_id?: string | null
          user_id?: string
          validation_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_biometric_credentials: {
        Row: {
          created_at: string
          credential_id: string
          device_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          sign_count: number
          transports: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          sign_count?: number
          transports?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string
          device_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          sign_count?: number
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      resident_ids: {
        Row: {
          created_at: string
          doc_path: string | null
          id: string
          id_number: string
          id_type: string
          resident_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          doc_path?: string | null
          id?: string
          id_number: string
          id_type: string
          resident_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          doc_path?: string | null
          id?: string
          id_number?: string
          id_type?: string
          resident_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      resident_passes: {
        Row: {
          code: string
          created_at: string
          credential_id: string | null
          estate_id: string
          expires_at: string
          guest_name: string | null
          id: string
          issued_via: string
          kind: Database["public"]["Enums"]["resident_pass_kind"]
          resident_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          credential_id?: string | null
          estate_id: string
          expires_at: string
          guest_name?: string | null
          id?: string
          issued_via?: string
          kind?: Database["public"]["Enums"]["resident_pass_kind"]
          resident_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          credential_id?: string | null
          estate_id?: string
          expires_at?: string
          guest_name?: string | null
          id?: string
          issued_via?: string
          kind?: Database["public"]["Enums"]["resident_pass_kind"]
          resident_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resident_passes_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_requests: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          details: string | null
          estate_id: string
          id: string
          resident_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          category: string
          created_at?: string
          details?: string | null
          estate_id: string
          id?: string
          resident_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          details?: string | null
          estate_id?: string
          id?: string
          resident_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_requests_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_items: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          estate_id: string
          id: string
          image_url: string | null
          name: string
          price_ngn: number
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          estate_id: string
          id?: string
          image_url?: string | null
          name: string
          price_ngn?: number
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          estate_id?: string
          id?: string
          image_url?: string | null
          name?: string
          price_ngn?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_items_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          amount_ngn: number
          created_at: string
          estate_id: string
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          quantity: number
          resident_id: string
          status: string
        }
        Insert: {
          amount_ngn?: number
          created_at?: string
          estate_id: string
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          quantity?: number
          resident_id: string
          status?: string
        }
        Update: {
          amount_ngn?: number
          created_at?: string
          estate_id?: string
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          quantity?: number
          resident_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      support_otps: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          email: string
          estate_id: string
          expires_at: string
          id: string
          purpose: string
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          email: string
          estate_id: string
          expires_at: string
          id?: string
          purpose?: string
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string
          estate_id?: string
          expires_at?: string
          id?: string
          purpose?: string
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_otps_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          body: string
          created_at: string
          estate_id: string
          id: string
          resident_id: string
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          estate_id: string
          id?: string
          resident_id: string
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          estate_id?: string
          id?: string
          resident_id?: string
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          price: number
          quantity: number | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          price?: number
          quantity?: number | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          price?: number
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_device_sessions: {
        Row: {
          created_at: string
          device_id: string
          device_label: string | null
          last_seen_at: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          device_label?: string | null
          last_seen_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          device_label?: string | null
          last_seen_at?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_tags: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          estate_id: string
          id: string
          make_model: string | null
          plate: string
          resident_id: string
          tag_number: string | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          estate_id: string
          id?: string
          make_model?: string | null
          plate: string
          resident_id: string
          tag_number?: string | null
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          estate_id?: string
          id?: string
          make_model?: string | null
          plate?: string
          resident_id?: string
          tag_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_tags_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      vtu_providers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          metadata: Json
          name: string
          service_type: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          service_type: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          service_type?: string
        }
        Relationships: []
      }
      vtu_transactions: {
        Row: {
          amount: number
          created_at: string
          estate_id: string | null
          id: string
          meta: Json
          package_label: string | null
          provider_code: string
          provider_name: string
          recipient: string
          reference: string
          service_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          estate_id?: string | null
          id?: string
          meta?: Json
          package_label?: string | null
          provider_code: string
          provider_name: string
          recipient: string
          reference: string
          service_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          estate_id?: string | null
          id?: string
          meta?: Json
          package_label?: string | null
          provider_code?: string
          provider_name?: string
          recipient?: string
          reference?: string
          service_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vtu_transactions_estate_id_fkey"
            columns: ["estate_id"]
            isOneToOne: false
            referencedRelation: "estates"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          consumed_at: string | null
          created_at: string
          credential_id: string | null
          expires_at: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          challenge: string
          consumed_at?: string | null
          created_at?: string
          credential_id?: string | null
          expires_at?: string
          id?: string
          purpose: string
          user_id: string
        }
        Update: {
          challenge?: string
          consumed_at?: string | null
          created_at?: string
          credential_id?: string | null
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_estate: { Args: { _estate_id: string }; Returns: undefined }
      admin_generate_support_otp: {
        Args: { _email: string; _purpose?: string }
        Returns: Json
      }
      admin_grant_multi_code: {
        Args: { _email: string; _ttl_minutes: number }
        Returns: Json
      }
      admin_recent_support_otps: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          used_at: string
        }[]
      }
      admin_record_bill_payment: {
        Args: { _bill_id: string; _method?: string; _reference?: string }
        Returns: undefined
      }
      admin_register_device: {
        Args: { _device_type: string; _location: string; _name: string }
        Returns: string
      }
      admin_set_device_status: {
        Args: { _device_id: string; _status: string }
        Returns: undefined
      }
      admin_upsert_biometric_access: {
        Args: {
          _access_status: string
          _biometric_type: string
          _dependent_id: string
          _device_id: string
          _enrollment_status: string
          _notes: string
          _resident_id: string
        }
        Returns: string
      }
      admin_waive_payments: {
        Args: { _email: string; _end_date: string; _start_date?: string }
        Returns: Json
      }
      assign_estate_admin: {
        Args: { _estate_id: string; _user_id: string }
        Returns: undefined
      }
      assign_guard_to_current_estate: {
        Args: { _user_id: string }
        Returns: undefined
      }
      begin_pass_challenge: { Args: { _credential_id: string }; Returns: Json }
      broadcast_message: {
        Args: { _body: string; _link?: string; _title: string }
        Returns: number
      }
      claim_device_session: {
        Args: {
          _device_id: string
          _device_label?: string
          _force?: boolean
          _user_agent?: string
        }
        Returns: Json
      }
      create_estate_admin_invite: {
        Args: { _email: string; _estate_id: string }
        Returns: string
      }
      create_meeting_and_notify: {
        Args: {
          _description: string
          _join_url: string
          _location: string
          _starts_at: string
          _title: string
        }
        Returns: string
      }
      current_estate_id: { Args: never; Returns: string }
      current_role_is: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      enroll_biometric_credential: {
        Args: {
          _credential_id: string
          _device_name: string
          _public_key: string
          _transports: string[]
        }
        Returns: string
      }
      generate_unique_estate_code: { Args: never; Returns: string }
      guard_biometric_status: {
        Args: { _resident_id: string }
        Returns: {
          access_status: string
          biometric_type: string
          enrollment_status: string
        }[]
      }
      guard_check_in: {
        Args: { _invite_id: string; _vehicle_number?: string }
        Returns: Json
      }
      guard_check_out: { Args: { _invite_id: string }; Returns: Json }
      guard_use_resident_pass: { Args: { _code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      issue_resident_pass: {
        Args: {
          _credential_id: string
          _guest_name: string
          _kind: Database["public"]["Enums"]["resident_pass_kind"]
          _ttl_minutes: number
        }
        Returns: Json
      }
      issue_resident_pass_verified: {
        Args: {
          _challenge_id: string
          _credential_id: string
          _guest_name: string
          _kind: Database["public"]["Enums"]["resident_pass_kind"]
          _ttl_minutes: number
          _user_id: string
        }
        Returns: Json
      }
      log_activity: {
        Args: {
          _action: string
          _entity?: string
          _entity_id?: string
          _metadata?: Json
        }
        Returns: string
      }
      lookup_estate_by_code: {
        Args: { _code: string }
        Returns: {
          code: string
          id: string
          name: string
          status: Database["public"]["Enums"]["estate_status"]
        }[]
      }
      pay_bill: {
        Args: { _bill_id: string; _method?: string; _reference?: string }
        Returns: undefined
      }
      place_shop_order: {
        Args: { _item_id: string; _quantity?: number }
        Returns: string
      }
      platform_rollup: { Args: never; Returns: Json }
      poll_vote_tallies: {
        Args: never
        Returns: {
          item_id: string
          option_key: string
          poll_id: string
          votes: number
        }[]
      }
      post_comment_counts: {
        Args: never
        Returns: {
          comments: number
          post_id: string
        }[]
      }
      post_comment_thread: {
        Args: { _post_id: string }
        Returns: {
          author_avatar_url: string
          author_id: string
          author_is_admin: boolean
          author_name: string
          body: string
          created_at: string
          id: string
          post_id: string
        }[]
      }
      post_like_counts: {
        Args: never
        Returns: {
          likes: number
          post_id: string
        }[]
      }
      reassign_estate_admin: {
        Args: { _estate_id: string; _new_admin_user_id: string }
        Returns: undefined
      }
      redeem_estate_admin_invite: { Args: { _token: string }; Returns: string }
      release_device_session: {
        Args: { _device_id: string }
        Returns: undefined
      }
      remove_estate_admin: { Args: { _estate_id: string }; Returns: undefined }
      review_verification: {
        Args: { _approve: boolean; _notes: string; _user_id: string }
        Returns: undefined
      }
      set_estate_access: {
        Args: { _approved: boolean; _user_id: string }
        Returns: undefined
      }
      set_estate_feature_flag: {
        Args: { _enabled: boolean; _estate_id: string; _key: string }
        Returns: undefined
      }
      set_estate_plan: {
        Args: {
          _estate_id: string
          _expires_at: string
          _plan_id: string
          _status: string
        }
        Returns: undefined
      }
      submit_verification: {
        Args: {
          _block: string
          _doc_path: string
          _full_name: string
          _house_number: string
          _occupant_type: Database["public"]["Enums"]["occupant_type"]
          _phone: string
          _street: string
        }
        Returns: undefined
      }
      super_admin_invite_link: { Args: { _invite_id: string }; Returns: string }
      super_estate_overview: { Args: { _estate_id: string }; Returns: Json }
      suspend_estate: {
        Args: { _estate_id: string; _reason?: string }
        Returns: undefined
      }
      update_estate: {
        Args: {
          _address: string
          _city: string
          _contact_email: string
          _contact_phone: string
          _estate_id: string
          _name: string
          _state: string
        }
        Returns: undefined
      }
      validate_guest_code: { Args: { _code: string }; Returns: Json }
      validate_resident_pass: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "resident"
        | "guard"
        | "estate_admin"
        | "super_admin"
        | "event_organizer"
      bill_status: "unpaid" | "paid" | "overdue" | "waived"
      estate_status: "active" | "suspended"
      invite_status: "active" | "used" | "expired" | "revoked"
      issue_severity: "low" | "medium" | "high" | "critical"
      issue_status: "open" | "in_progress" | "resolved"
      occupant_type: "resident" | "commercial"
      resident_pass_kind: "self" | "guest"
      verification_status:
        | "not_submitted"
        | "incomplete"
        | "pending"
        | "approved"
        | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "resident",
        "guard",
        "estate_admin",
        "super_admin",
        "event_organizer",
      ],
      bill_status: ["unpaid", "paid", "overdue", "waived"],
      estate_status: ["active", "suspended"],
      invite_status: ["active", "used", "expired", "revoked"],
      issue_severity: ["low", "medium", "high", "critical"],
      issue_status: ["open", "in_progress", "resolved"],
      occupant_type: ["resident", "commercial"],
      resident_pass_kind: ["self", "guest"],
      verification_status: [
        "not_submitted",
        "incomplete",
        "pending",
        "approved",
        "rejected",
      ],
    },
  },
} as const
