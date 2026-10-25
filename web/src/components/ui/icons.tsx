import * as React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import {
  Add01Icon,
  Alert01Icon,
  AlertCircleIcon,
  Archive01Icon,
  ArrowLeft01Icon,
  ArrowLeftRightIcon as ArrowLeftRightGlyph,
  ArrowRight01Icon,
  ArrowUpDownIcon as ArrowUpDownGlyph,
  BanknoteIcon as BanknoteGlyph,
  BellIcon,
  BoldIcon,
  Bookmark01Icon,
  BookUserIcon as BookUserGlyph,
  Briefcase01Icon,
  Building01Icon,
  Calendar01Icon,
  CalendarDaysIcon,
  CalendarRangeIcon,
  CallIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CheckmarkSquare02Icon,
  ChevronDownIcon as ChevronDownGlyph,
  ChevronLeftIcon as ChevronLeftGlyph,
  ChevronRightIcon as ChevronRightGlyph,
  ChevronUpIcon as ChevronUpGlyph,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleDotIcon as CircleDotGlyph,
  Clock01Icon,
  CodeIcon,
  Compass01Icon,
  Copy01Icon,
  CornerDownRightIcon as CornerDownRightGlyph,
  CrosshairIcon,
  Delete02Icon,
  Dollar01Icon,
  Download01Icon,
  Edit01Icon,
  EllipsisVerticalIcon as EllipsisVerticalGlyph,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  Facebook01Icon,
  File01Icon,
  Folder01Icon,
  FolderAddIcon,
  FolderInputIcon,
  FolderOpenIcon,
  GlobeIcon as GlobeGlyph,
  GridIcon,
  GripVerticalIcon as GripVerticalGlyph,
  HardDriveIcon,
  HashIcon as HashGlyph,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  HeartIcon,
  HelpCircleIcon,
  Home01Icon,
  Image01Icon,
  InstagramIcon,
  ItalicIcon,
  Layers01Icon,
  LayoutDashboardIcon,
  Link01Icon,
  ListFilterIcon as ListFilterGlyph,
  ListFilterPlusIcon as ListFilterPlusGlyph,
  ListIcon,
  ListOrderedIcon,
  Loading03Icon,
  LocateIcon,
  Logout01Icon,
  Mail01Icon,
  MapPinIcon as MapPinGlyph,
  Menu01Icon,
  MessageSquareIcon,
  MinusIcon as MinusGlyph,
  MonitorIcon,
  Moon01Icon,
  MoreVerticalIcon,
  Package01Icon,
  PaletteIcon,
  PencilIcon,
  PenLineIcon,
  QuoteIcon,
  Refresh01Icon,
  Rotate01Icon,
  Route01Icon,
  Search01Icon,
  SettingsIcon,
  Share02Icon,
  Shield01Icon,
  ShieldCheckIcon,
  SlidersHorizontalIcon as SlidersHorizontalGlyph,
  SparklesIcon,
  Square01Icon,
  StarIcon as StarGlyph,
  Sun01Icon,
  Tick01Icon,
  TickDouble01Icon,
  TypeIcon as TypeGlyph,
  UngroupIcon as UngroupGlyph,
  Upload01Icon,
  User02Icon,
  UserCheckIcon,
  UserMinusIcon as UserMinusGlyph,
  UsersIcon,
} from '@hugeicons/core-free-icons'

/*
 * The single icon source for the whole app: every glyph is a Hugeicons stroke
 * icon, wrapped so call sites keep the tiny prop surface they already use
 * (className for sizing and colour, size, strokeWidth).
 */

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, 'ref'> & {
  size?: number | string
  strokeWidth?: number | string
}

export type IconComponent = React.ForwardRefExoticComponent<
  IconProps & React.RefAttributes<SVGSVGElement>
>

function make(icon: IconSvgElement, displayName: string): IconComponent {
  const Component = React.forwardRef<SVGSVGElement, IconProps>(
    ({ strokeWidth, ...props }, ref) => (
      <HugeiconsIcon
        ref={ref}
        icon={icon}
        strokeWidth={strokeWidth === undefined ? undefined : Number(strokeWidth)}
        {...props}
      />
    ),
  )
  Component.displayName = displayName
  return Component
}

export const Add01 = make(Add01Icon, 'Add01')
export const AlertTriangle = make(Alert01Icon, 'AlertTriangle')
export const AlertCircle = make(AlertCircleIcon, 'AlertCircle')
export const Archive = make(Archive01Icon, 'Archive')
export const ArrowLeft = make(ArrowLeft01Icon, 'ArrowLeft')
export const ArrowLeftRight = make(ArrowLeftRightGlyph, 'ArrowLeftRight')
export const ArrowRight = make(ArrowRight01Icon, 'ArrowRight')
export const ArrowUpDown = make(ArrowUpDownGlyph, 'ArrowUpDown')
export const Banknote = make(BanknoteGlyph, 'Banknote')
export const Bell = make(BellIcon, 'Bell')
export const Bold = make(BoldIcon, 'Bold')
export const Bookmark = make(Bookmark01Icon, 'Bookmark')
export const Briefcase = make(Briefcase01Icon, 'Briefcase')
export const BookUser = make(BookUserGlyph, 'BookUser')
export const Building2 = make(Building01Icon, 'Building2')
export const Calendar = make(Calendar01Icon, 'Calendar')
export const CalendarDays = make(CalendarDaysIcon, 'CalendarDays')
export const CalendarRange = make(CalendarRangeIcon, 'CalendarRange')
export const Phone = make(CallIcon, 'Phone')
export const X = make(Cancel01Icon, 'X')
export const CheckCircle = make(CheckmarkCircle02Icon, 'CheckCircle')
export const CheckSquare = make(CheckmarkSquare02Icon, 'CheckSquare')
export const ChevronDown = make(ChevronDownGlyph, 'ChevronDown')
export const ChevronLeft = make(ChevronLeftGlyph, 'ChevronLeft')
export const ChevronRight = make(ChevronRightGlyph, 'ChevronRight')
export const ChevronUp = make(ChevronUpGlyph, 'ChevronUp')
export const ChevronsLeft = make(ChevronsLeftIcon, 'ChevronsLeft')
export const ChevronsRight = make(ChevronsRightIcon, 'ChevronsRight')
export const CircleDot = make(CircleDotGlyph, 'CircleDot')
export const Clock = make(Clock01Icon, 'Clock')
export const Code = make(CodeIcon, 'Code')
export const Compass = make(Compass01Icon, 'Compass')
export const Copy = make(Copy01Icon, 'Copy')
export const CornerDownRight = make(CornerDownRightGlyph, 'CornerDownRight')
export const Crosshair = make(CrosshairIcon, 'Crosshair')
export const Trash2 = make(Delete02Icon, 'Trash2')
export const DollarSign = make(Dollar01Icon, 'DollarSign')
export const Download = make(Download01Icon, 'Download')
export const Edit = make(Edit01Icon, 'Edit')
export const EllipsisVertical = make(EllipsisVerticalGlyph, 'EllipsisVertical')
export const Eye = make(EyeIcon, 'Eye')
export const EyeOff = make(EyeOffIcon, 'EyeOff')
export const ExternalLink = make(ExternalLinkIcon, 'ExternalLink')
export const Facebook = make(Facebook01Icon, 'Facebook')
export const File = make(File01Icon, 'File')
export const Folder = make(Folder01Icon, 'Folder')
export const FolderPlus = make(FolderAddIcon, 'FolderPlus')
export const FolderPlusIcon = FolderPlus
export const FolderInput = make(FolderInputIcon, 'FolderInput')
export const FolderOpen = make(FolderOpenIcon, 'FolderOpen')
export const Globe = make(GlobeGlyph, 'Globe')
export const LocateFixed = make(LocateIcon, 'LocateFixed')
export const Grid = make(GridIcon, 'Grid')
export const GripVertical = make(GripVerticalGlyph, 'GripVertical')
export const HardDrive = make(HardDriveIcon, 'HardDrive')
export const Hash = make(HashGlyph, 'Hash')
export const Heading1 = make(Heading01Icon, 'Heading1')
export const Heading2 = make(Heading02Icon, 'Heading2')
export const Heading3 = make(Heading03Icon, 'Heading3')
export const Heart = make(HeartIcon, 'Heart')
export const HelpCircle = make(HelpCircleIcon, 'HelpCircle')
export const Home = make(Home01Icon, 'Home')
export const Image = make(Image01Icon, 'Image')
export const Instagram = make(InstagramIcon, 'Instagram')
export const Italic = make(ItalicIcon, 'Italic')
export const Layers = make(Layers01Icon, 'Layers')
export const LayoutDashboard = make(LayoutDashboardIcon, 'LayoutDashboard')
export const Link = make(Link01Icon, 'Link')
export const ListFilter = make(ListFilterGlyph, 'ListFilter')
export const List = make(ListIcon, 'List')
export const ListOrdered = make(ListOrderedIcon, 'ListOrdered')
export const Loader2 = make(Loading03Icon, 'Loader2')
export const LogOut = make(Logout01Icon, 'LogOut')
export const Mail = make(Mail01Icon, 'Mail')
export const MapPin = make(MapPinGlyph, 'MapPin')
export const Menu = make(Menu01Icon, 'Menu')
export const MessageSquare = make(MessageSquareIcon, 'MessageSquare')
export const Minus = make(MinusGlyph, 'Minus')
export const Monitor = make(MonitorIcon, 'Monitor')
export const Moon = make(Moon01Icon, 'Moon')
export const MoreVertical = make(MoreVerticalIcon, 'MoreVertical')
export const Package = make(Package01Icon, 'Package')
export const Palette = make(PaletteIcon, 'Palette')
export const Pencil = make(PencilIcon, 'Pencil')
export const PenLine = make(PenLineIcon, 'PenLine')
export const Plus = make(Add01Icon, 'Plus')
export const Quote = make(QuoteIcon, 'Quote')
export const RefreshCw = make(Refresh01Icon, 'RefreshCw')
export const RotateCw = make(Rotate01Icon, 'RotateCw')
export const Route = make(Route01Icon, 'Route')
export const Search = make(Search01Icon, 'Search')
export const Settings = make(SettingsIcon, 'Settings')
export const Share2 = make(Share02Icon, 'Share2')
export const Shield = make(Shield01Icon, 'Shield')
export const ShieldCheck = make(ShieldCheckIcon, 'ShieldCheck')
export const SlidersHorizontal = make(SlidersHorizontalGlyph, 'SlidersHorizontal')
export const Sparkles = make(SparklesIcon, 'Sparkles')
export const Square = make(Square01Icon, 'Square')
export const Star = make(StarGlyph, 'Star')
export const Sun = make(Sun01Icon, 'Sun')
export const Check = make(Tick01Icon, 'Check')
export const CheckCheck = make(TickDouble01Icon, 'CheckCheck')
export const Type = make(TypeGlyph, 'Type')
export const Ungroup = make(UngroupGlyph, 'Ungroup')
export const Upload = make(Upload01Icon, 'Upload')
export const User = make(User02Icon, 'User')
export const UserCheck = make(UserCheckIcon, 'UserCheck')
export const UserMinus = make(UserMinusGlyph, 'UserMinus')
export const Users = make(UsersIcon, 'Users')
export const UserRoundCheck = make(UserCheckIcon, 'UserRoundCheck')

/* Lucide also shipped suffixed aliases; keep them so call sites read the same. */
export const ArchiveIcon = Archive
export const ArrowLeftIcon = ArrowLeft
export const ArrowLeftRightIcon = ArrowLeftRight
export const ArrowRightIcon = ArrowRight
export const ArrowUpDownIcon = ArrowUpDown
export const BanknoteIcon = Banknote
export const BookUserIcon = BookUser
export const Building2Icon = Building2
export const CalendarIcon = Calendar
export const ChevronDownIcon = ChevronDown
export const ChevronLeftIcon = ChevronLeft
export const ChevronRightIcon = ChevronRight
export const ChevronUpIcon = ChevronUp
export const CheckIcon = Check
export const CircleAlertIcon = AlertCircle
export const CircleDotIcon = CircleDot
export const CompassIcon = Compass
export const CopyIcon = Copy
export const CornerDownRightIcon = CornerDownRight
export const EllipsisVerticalIcon = EllipsisVertical
export const GlobeIcon = Globe
export const GripVerticalIcon = GripVertical
export const HashIcon = Hash
export const LayersIcon = Layers
export const ListFilterIcon = ListFilter
export const ListFilterPlusIcon = make(ListFilterPlusGlyph, 'ListFilterPlus')
export const Loader2Icon = Loader2
export const LoaderCircleIcon = Loader2
export const MapPinIcon = MapPin
export const MinusIcon = Minus
export const PlusIcon = Plus
export const RefreshCwIcon = RefreshCw
export const RotateCwIcon = RotateCw
export const SlidersHorizontalIcon = SlidersHorizontal
export const StarIcon = Star
export const Trash2Icon = Trash2
export const TypeIcon = Type
export const UngroupIcon = Ungroup
export const UserMinusIcon = UserMinus
export const UserRoundCheckIcon = UserRoundCheck
export const XIcon = X
