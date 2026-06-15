export type QuestionType = "text" | "select" | "multi"

export type Question = {
  id: string
  label: string
  type: QuestionType
  placeholder?: string
  options?: string[]
}

export const questions: Question[] = [
  { id: "name", label: "Full Name", type: "text", placeholder: "Your name" },
  { id: "email", label: "Email Address", type: "text", placeholder: "your@email.com" },
  { id: "phone", label: "Mobile Number", type: "text", placeholder: "(803) 555-0142" },
  { id: "age_range", label: "Age Range", type: "select", options: ["25–34", "35–44", "45–54", "55–64", "65+"] },
  {
    id: "neighborhood",
    label: "What part of Columbia are you in?",
    type: "select",
    options: [
      "Downtown / Vista",
      "Five Points",
      "Shandon / Rosewood",
      "Northeast Columbia",
      "West Columbia",
      "Irmo / Lake Murray",
      "Fort Jackson area",
      "Other / Just visiting",
    ],
  },
  {
    id: "motivation",
    label: "What brought you here?",
    type: "select",
    options: [
      "New to Columbia",
      "Rebuilding my social life",
      "Looking for deeper friendships",
      "Just curious and open",
      "My therapist said get out more",
    ],
  },
  {
    id: "talk_about",
    label: "Topics you could talk about for hours (pick up to 3)",
    type: "multi",
    options: [
      "Food & cooking",
      "Music",
      "Travel",
      "Business & entrepreneurship",
      "Wellness & mental health",
      "Sports",
      "Art & creativity",
      "Tech & innovation",
      "Parenting",
      "Faith & spirituality",
      "Social justice",
      "Pop culture",
      "Books & writing",
      "Nature & outdoors",
    ],
  },
  {
    id: "skip_topics",
    label: "Topics you'd rather skip",
    type: "multi",
    options: ["Politics", "Religion", "Relationships / dating", "Work stress", "None — I'm open to anything"],
  },
  {
    id: "energy",
    label: "Your social energy",
    type: "select",
    options: [
      "Introvert — I recharge alone but love good conversation",
      "Ambivert — depends on the room",
      "Extrovert — feed me people",
    ],
  },
  {
    id: "surprise",
    label: "Something surprising about you",
    type: "text",
    placeholder: "e.g. I once lived in a converted school bus for 6 months",
  },
  {
    id: "hope",
    label: "What do you hope to walk away with?",
    type: "text",
    placeholder: "A new friend, a business contact, a good laugh...",
  },
]

export const MAX_TOPICS = 3

export type Guest = {
  id: number
  event_id: number | null
  name: string
  email: string
  phone: string | null
  age_range: string | null
  neighborhood: string | null
  motivation: string | null
  talk_about: string[]
  skip_topics: string[]
  energy: string | null
  surprise: string | null
  hope: string | null
  submitted_at: string
  cancel_token: string
  cancelled: boolean
  cancelled_at: string | null
  details_sent_at: string | null
  reminder_sent_at: string | null
  confirmed: boolean
  confirmed_at: string | null
  table_label: string | null
  feedback_sent_at: string | null
  feedback_rating: number | null
  feedback_comment: string | null
  feedback_submitted_at: string | null
}

// A saved contact in the permanent pool. Mirrors the profile fields of a guest
// (minus event-specific RSVP/seating state) so a contact can be imported into
// any future dinner as a fresh guest.
export type PoolContact = {
  id: number
  name: string
  email: string | null
  phone: string | null
  age_range: string | null
  neighborhood: string | null
  motivation: string | null
  talk_about: string[]
  skip_topics: string[]
  energy: string | null
  surprise: string | null
  hope: string | null
  source_guest_id: number | null
  created_at: string
}

export type EventInfo = {
  id: number
  restaurant: string
  address: string
  date: string
  time: string
  maxGuests: string
  dressCode: string
  notes: string
  isOpen: boolean
}

export const emptyEventInfo: EventInfo = {
  id: 0,
  restaurant: "",
  address: "",
  date: "",
  time: "",
  maxGuests: "",
  dressCode: "",
  notes: "",
  isOpen: true,
}

// A new (unsaved) event uses id 0; saving assigns a real id.
export type EventDraft = Omit<EventInfo, "id">

export const emptyEventDraft: EventDraft = {
  restaurant: "",
  address: "",
  date: "",
  time: "",
  maxGuests: "",
  dressCode: "",
  notes: "",
  isOpen: true,
}

export type TableGroup = {
  table: string
  theme: string
  why: string
  guests: number[]
}
