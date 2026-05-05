import { SidebarButton, type SidebarButtonProps } from "@components/UI/Sidebar/SidebarButton.tsx";

type MessageSidebarButtonProps = Omit<SidebarButtonProps, "preventCollapse">;

export function MessageSidebarButton({ labelStyle, ...props }: MessageSidebarButtonProps) {
  return (
    <SidebarButton
      {...props}
      preventCollapse
      labelStyle={{
        fontSize: "90%",
        ...labelStyle,
      }}
    />
  );
}
