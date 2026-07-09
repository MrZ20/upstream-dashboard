import type { ThemeConfig } from 'antd';

const fontFamily = 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif';

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#5932EA',
    colorSuccess: '#00B087',
    colorWarning: '#F59E0B',
    colorError: '#DF0404',
    colorInfo: '#5932EA',
    colorText: '#292D32',
    colorTextSecondary: '#7E7E7E',
    colorTextTertiary: '#B5B7C0',
    colorBorder: '#EEEEEE',
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#FAFBFF',
    borderRadius: 8,
    fontFamily,
    boxShadow: '0 10px 60px rgba(226, 236, 249, 0.5)',
  },
  components: {
    Layout: {
      headerBg: '#FAFBFF',
      bodyBg: '#FAFBFF',
      siderBg: '#FFFFFF',
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: '#9197B3',
      itemHoverColor: '#5932EA',
      itemHoverBg: '#F3F0FF',
      itemSelectedBg: '#5932EA',
      itemSelectedColor: '#FFFFFF',
      itemBorderRadius: 8,
      iconSize: 17,
    },
    Card: {
      borderRadiusLG: 20,
      colorBorderSecondary: 'transparent',
      paddingLG: 28,
    },
    Table: {
      headerBg: '#FFFFFF',
      headerColor: '#B5B7C0',
      rowHoverBg: '#F9FBFF',
      borderColor: '#EEEEEE',
      cellPaddingBlock: 13,
      cellPaddingInline: 14,
      fontSize: 13,
    },
    Button: {
      borderRadius: 10,
      controlHeight: 38,
      primaryShadow: 'none',
    },
    Input: {
      borderRadius: 10,
      controlHeight: 38,
      colorBgContainer: '#F9FBFF',
      colorBorder: 'transparent',
      activeBorderColor: '#5932EA',
      hoverBorderColor: '#E7E1FF',
    },
    Select: {
      borderRadius: 10,
      controlHeight: 38,
      colorBgContainer: '#F9FBFF',
      colorBorder: 'transparent',
    },
    Pagination: {
      itemActiveBg: '#5932EA',
      colorPrimary: '#FFFFFF',
      colorPrimaryHover: '#FFFFFF',
      borderRadius: 4,
    },
    Tag: {
      borderRadiusSM: 4,
      fontSizeSM: 12,
    },
  },
};
